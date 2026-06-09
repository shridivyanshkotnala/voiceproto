import { ConversationProfile } from '../models/conversationProfile.model.js'
import { ApiError } from '../utils/ApiError.js'
import { analyzeQueryIntelligence } from './queryIntelligence.service.js'
import { runHybridRetrieval } from './hybridRetrieval.service.js'
import { rerankCandidates } from './reranker.service.js'
import { optimizeContext } from './contextOptimizer.service.js'
import { estimateTokens } from '../utils/tokenBudget.util.js'
import {
  boostFormulaCandidates,
  buildFormulaExpandedQueries,
  pickFormulaCandidates,
  shouldUseFormulaPath,
} from './formulaRetrieval.service.js'

const NO_CONTEXT_SCORE_THRESHOLD = Number(process.env.RETRIEVAL_NO_CONTEXT_SCORE_THRESHOLD || 0.42)
const NO_CONTEXT_MIN_MATCHES = Number(process.env.RETRIEVAL_NO_CONTEXT_MIN_MATCHES || 2)

function mergeCandidates(candidates = []) {
  const merged = new Map()
  for (const candidate of candidates) {
    if (!candidate) continue
    const key = String(candidate?._id || `${candidate?.documentId || ''}:${candidate?.chunkIndex || ''}:${candidate?.metadata?.source || ''}`)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, candidate)
      continue
    }

    merged.set(key, {
      ...existing,
      ...candidate,
      vectorScore: Math.max(Number(existing.vectorScore || existing.score || 0), Number(candidate.vectorScore || candidate.score || 0)),
      keywordScore: Math.max(Number(existing.keywordScore || 0), Number(candidate.keywordScore || 0)),
    })
  }
  return Array.from(merged.values())
}

function evaluateNeedsFallback({ averageScore, compressed, reranked }) {
  const noContext = !String(compressed?.contextText || '').trim()
  const lowScore = Number(averageScore || 0) < NO_CONTEXT_SCORE_THRESHOLD
  const tooFewMatches = Number(reranked?.topCandidates?.length || 0) < NO_CONTEXT_MIN_MATCHES
  return noContext || lowScore || tooFewMatches
}

// Orchestrates retrieval flow for RAG context.
// Input: query, sessionId
// Output: retrieval payload with context
export async function runRetrieval(
  { query, sessionId, conversationHistory = [], realtimeMode = false },
  deps = {},
) {
  const ConversationProfileModel = deps.ConversationProfileModel || ConversationProfile
  const analyzeQueryIntelligenceFn =
    deps.analyzeQueryIntelligenceFn || analyzeQueryIntelligence
  const runHybridRetrievalFn = deps.runHybridRetrievalFn || runHybridRetrieval
  const rerankCandidatesFn = deps.rerankCandidatesFn || rerankCandidates
  const optimizeContextFn = deps.contextOptimizeFn || deps.compressContextFn || optimizeContext

  if (!query || !query.trim()) {
    throw new ApiError(400, 'Query is required')
  }

  const profile = sessionId
    ? await ConversationProfileModel.findOne({ sessionId }).lean()
    : null

  const indexName = process.env.VECTOR_SEARCH_INDEX
  if (!indexName) {
    throw new ApiError(500, 'VECTOR_SEARCH_INDEX is not configured.')
  }
  const startedAt = Date.now()
  const queryStart = Date.now()
  const queryIntelligence = analyzeQueryIntelligenceFn({
    query,
    conversationHistory,
  })
  const queryNormalizationTime = Date.now() - queryStart

  const hybridResult = await runHybridRetrievalFn({
    query,
    normalizedQuery: queryIntelligence.normalizedQuery,
    expandedQueries: queryIntelligence.expandedQueries,
    indexName,
    preferredDocumentTypes: [
      queryIntelligence.domain,
      queryIntelligence.queryType,
      queryIntelligence.queryType === 'troubleshooting' ? 'troubleshooting' : null,
    ].filter(Boolean),
    sessionId,
    realtimeMode,
  })

  let candidatePool = [...hybridResult.candidates]
  let formulaPathUsed = false

  if (shouldUseFormulaPath(queryIntelligence)) {
    formulaPathUsed = true
    const formulaExpandedQueries = buildFormulaExpandedQueries(queryIntelligence)
    const formulaResult = await runHybridRetrievalFn({
      query,
      normalizedQuery: queryIntelligence.normalizedQuery,
      expandedQueries: formulaExpandedQueries,
      indexName,
      preferredDocumentTypes: ['formula', 'pricing'],
      sessionId,
      realtimeMode,
    })

    candidatePool = mergeCandidates([
      ...candidatePool,
      ...pickFormulaCandidates(formulaResult.candidates, 18),
    ])
    candidatePool = boostFormulaCandidates(candidatePool, queryIntelligence)
  }

  const rerankStart = Date.now()
  const reranked = rerankCandidatesFn({
    candidates: candidatePool,
    queryIntelligence,
  })
  const rerankingTime = Date.now() - rerankStart

  const compressionStart = Date.now()
  const compressed = optimizeContextFn({
    candidates: reranked.topCandidates,
    query: queryIntelligence.normalizedQuery || query,
    queryIntelligence,
  })
  const compressionTime = Date.now() - compressionStart

  let finalReranked = reranked
  let finalCompressed = compressed
  let fallbackLayersUsed = []

  const primaryScoringCandidates = reranked.topCandidates.length
    ? reranked.topCandidates
    : reranked.ranked

  const primaryAverageScore = primaryScoringCandidates.length
    ? Number(
        (
          primaryScoringCandidates.reduce((sum, match) => sum + (match.finalScore || 0), 0) /
          primaryScoringCandidates.length
        ).toFixed(3),
      )
    : 0

  if (evaluateNeedsFallback({ averageScore: primaryAverageScore, compressed, reranked })) {
    const fallbackExpandedQueries = Array.from(
      new Set([...(queryIntelligence.expandedQueries || [])]),
    )

    const fallbackResult = await runHybridRetrievalFn({
      query,
      normalizedQuery: queryIntelligence.normalizedQuery,
      expandedQueries: [
        ...(queryIntelligence.expandedQueries || []),
        ...fallbackExpandedQueries,
        ...(queryIntelligence.semanticExpansions || []),
        'system operations troubleshooting report workflow',
      ],
      indexName,
      preferredDocumentTypes: [
        queryIntelligence.domain,
        'troubleshooting',
        'operations',
        'reports',
        'faq',
        'formula',
        'pricing',
        'scanner',
        'inventory',
      ].filter(Boolean),
      sessionId,
      realtimeMode,
    })

    fallbackLayersUsed = ['vector', 'keyword', 'metadata', 'document', 'fallback_retrieval']
    const mergedFallbackCandidates = mergeCandidates([
      ...candidatePool,
      ...fallbackResult.candidates,
    ])

    const fallbackReranked = rerankCandidatesFn({
      candidates: mergedFallbackCandidates,
      queryIntelligence,
    })

    const fallbackCompressed = optimizeContextFn({
      candidates: fallbackReranked.topCandidates,
      query: queryIntelligence.normalizedQuery || query,
      queryIntelligence,
    })

    if (String(fallbackCompressed.contextText || '').trim()) {
      finalReranked = fallbackReranked
      finalCompressed = fallbackCompressed
      candidatePool = mergedFallbackCandidates
    }
  }

  const context = finalCompressed.contextText || null

  const scoringCandidates = finalReranked.topCandidates.length
    ? finalReranked.topCandidates
    : finalReranked.ranked

  const averageScore = scoringCandidates.length
    ? Number(
        (
          scoringCandidates.reduce((sum, match) => sum + (match.finalScore || 0), 0) /
          scoringCandidates.length
        ).toFixed(3),
      )
    : 0

  const retrieval = {
    totalMatches:
      finalCompressed?.stats?.finalChunks ||
      finalCompressed?.stats?.chunksUsed ||
      finalCompressed?.citations?.length ||
      0,
    averageScore,
  }

  const response = {
    query,
    languageProfile: profile
      ? {
          language: profile.language,
          hinglishStyle: profile.hinglishStyle,
          formality: profile.formality,
          persona: profile.persona,
        }
      : null,
    retrieval,
    context,
    usage: hybridResult.usage,
    citations: finalCompressed.citations,
    sourceChunksUsed: finalCompressed.sourceChunks,
    retrievalScore: averageScore,
    sourceChunks: finalCompressed.sourceChunks,
    queryIntelligence,
    grounding: {
      context,
      citations: finalCompressed.citations,
      sourceChunks: finalCompressed.sourceChunks,
    },
    optimizer: {
      route: finalCompressed.intentRoute || null,
      stats: finalCompressed.stats || null,
    },
    quality: {
      formulaPathUsed,
      fallbackLayersUsed,
      noContext: !context,
    },
    metrics: {
      queryNormalizationTime,
      vectorSearchTime: hybridResult.metrics.vectorSearchTime,
      keywordSearchTime: hybridResult.metrics.keywordSearchTime,
      rerankingTime,
      compressionTime,
      totalRetrievalTime: Date.now() - startedAt,
      contextTokens: estimateTokens(context || ''),
      candidatePoolSize: candidatePool.length,
    },
  }

  console.info('[retrieval-layer]', {
    query,
    queryType: queryIntelligence.queryType,
    domain: queryIntelligence.domain,
    retrievedChunks: candidatePool.length,
    rerankedChunks: finalReranked.topCandidates.length,
    finalChunks: finalCompressed?.stats?.finalChunks || finalCompressed?.stats?.chunksUsed || 0,
    contextTokens: response.metrics.contextTokens,
    compressionRatio: finalCompressed?.stats?.compressionRatio || 0,
    retrievalScore: averageScore,
    metrics: response.metrics,
    formulaPathUsed,
    fallbackLayersUsed,
  })

  if (!context) {
    response.message = 'No relevant context found.'
  }

  if (process.env.NODE_ENV !== 'production') {
    response.debug = {
      queryEmbeddingGenerated: true,
      rawMatches: candidatePool.length,
      filteredMatches: finalReranked.ranked.length,
      rerankedMatches: finalReranked.topCandidates.length,
      finalMatches: retrieval.totalMatches,
      averageSimilarity: averageScore,
      formulaPathUsed,
      fallbackLayersUsed,
    }
  }

  return response
}
