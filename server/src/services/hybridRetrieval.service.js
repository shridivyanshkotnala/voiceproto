import { ApiError } from '../utils/ApiError.js'
import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'
import { generateEmbedding } from './embedding.service.js'
import {
  searchDocumentChunks,
  searchKeywordChunks,
  searchMetadataChunks,
  searchSimilarChunks,
} from './vectorStore.service.js'
import { calculateUsageCost, saveUsageRecord } from './usageTracking.service.js'

function normalizeArray(items) {
  return Array.from(new Set(items.filter(Boolean)))
}

function buildDocumentTypeFilter(preferredDocumentTypes) {
  if (!Array.isArray(preferredDocumentTypes) || !preferredDocumentTypes.length) {
    return null
  }

  return {
    'metadata.documentType': { $in: preferredDocumentTypes },
  }
}

function hasPreferredFilterResults(results = []) {
  return Array.isArray(results) && results.length > 0
}

function normalizeKeywordScore(score, maxScore) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) {
    return 0
  }
  return Math.min(score / maxScore, 1)
}

function normalizeVectorScore(score) {
  if (!Number.isFinite(score)) return 0
  return Math.min(Math.max(score, 0), 1)
}

function clampTopK(value, min = 1, max = 50) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, Math.trunc(numeric)))
}

function mergeCandidates(vectorMatches, keywordMatches) {
  const merged = new Map()

  const addCandidate = (item, source) => {
    const key = String(item?._id || `${item?.documentId || ''}:${item?.chunkIndex || ''}`)
    const existing = merged.get(key) || { ...item }
    merged.set(key, {
      ...existing,
      ...item,
      vectorScore:
        source === 'vector'
          ? normalizeVectorScore(item?.score)
          : existing.vectorScore || 0,
      keywordScore:
        source === 'keyword'
          ? Number(item?.keywordScore || 0)
          : existing.keywordScore || 0,
    })
  }

  vectorMatches.forEach((match) => addCandidate(match, 'vector'))
  keywordMatches.forEach((match) => addCandidate(match, 'keyword'))

  return Array.from(merged.values())
}

function mergeExtendedCandidates({ vectorMatches, keywordMatches, metadataMatches, documentMatches }) {
  const base = mergeCandidates(vectorMatches, keywordMatches)
  const indexed = new Map(
    base.map((item) => [String(item?._id || `${item?.documentId || ''}:${item?.chunkIndex || ''}`), item]),
  )

  const applySecondary = (items, scoreField) => {
    for (const item of items || []) {
      const key = String(item?._id || `${item?.documentId || ''}:${item?.chunkIndex || ''}`)
      const existing = indexed.get(key) || { ...item }
      const secondaryScore = Number(item?.[scoreField] || 0)

      indexed.set(key, {
        ...existing,
        ...item,
        metadataScore: Math.max(Number(existing.metadataScore || 0), Number(item.metadataScore || 0)),
        documentScore: Math.max(Number(existing.documentScore || 0), Number(item.documentScore || 0)),
        keywordScore: Number(existing.keywordScore || 0),
        vectorScore: Number(existing.vectorScore || existing.score || 0),
        retrievalLayerScore: Number((Math.max(Number(existing.retrievalLayerScore || 0), secondaryScore)).toFixed(4)),
      })
    }
  }

  applySecondary(metadataMatches, 'metadataScore')
  applySecondary(documentMatches, 'documentScore')

  return Array.from(indexed.values())
}

// Hybrid retrieval: vector search + keyword search, then merge.
// Input: { query, normalizedQuery, expandedQueries, indexName, preferredDocumentTypes, sessionId }
// Output: { candidates, usage, metrics }
export async function runHybridRetrieval(
  {
    query,
    normalizedQuery,
    expandedQueries,
    indexName,
    preferredDocumentTypes,
    sessionId,
    realtimeMode = false,
  },
  deps = {},
) {
  const embeddingFn = deps.generateEmbeddingFn || generateEmbedding
  const vectorSearchFn = deps.searchSimilarChunksFn || searchSimilarChunks
  const keywordSearchFn = deps.searchKeywordChunksFn || searchKeywordChunks
  const metadataSearchFn = deps.searchMetadataChunksFn || searchMetadataChunks
  const documentSearchFn = deps.searchDocumentChunksFn || searchDocumentChunks
  const calculateUsageFn = deps.calculateUsageCostFn || calculateUsageCost
  const saveUsageFn = deps.saveUsageRecordFn || saveUsageRecord

  if (!indexName) {
    throw new ApiError(500, 'VECTOR_SEARCH_INDEX is not configured.')
  }

  const startTime = Date.now()
  const embeddingResult = await embeddingFn(normalizedQuery || query)

  const usage = embeddingResult.usage || {}
  const model = embeddingResult.model
  const inputTokens = usage.prompt_tokens || usage.total_tokens || 0
  const outputTokens = usage.completion_tokens || 0
  const usageSummary = calculateUsageFn({ model, inputTokens, outputTokens })

  const disableUsageTracking =
    String(process.env.DISABLE_USAGE_TRACKING).toLowerCase() === 'true' ||
    process.env.NODE_ENV === 'test'

  if (!disableUsageTracking) {
    await saveUsageFn({
      organizationId: 'default',
      sessionId: sessionId || 'anonymous',
      feature: 'rag_retrieval',
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
      requestType: 'embedding',
    })
  }

  const preferredFilter = buildDocumentTypeFilter(preferredDocumentTypes)
  const vectorTopK = clampTopK(
    realtimeMode
      ? RETRIEVAL_CONFIG.HYBRID_VECTOR_TOP_K || Math.min(RETRIEVAL_CONFIG.RAG_TOP_K, 12)
      : RETRIEVAL_CONFIG.HYBRID_VECTOR_TOP_K || RETRIEVAL_CONFIG.RAG_TOP_K,
  )
  const keywordTopK = clampTopK(
    realtimeMode
      ? Math.min(RETRIEVAL_CONFIG.HYBRID_KEYWORD_TOP_K, 10)
      : RETRIEVAL_CONFIG.HYBRID_KEYWORD_TOP_K,
  )
  const keywordQueryLimit = realtimeMode
    ? Number(process.env.RETRIEVAL_REALTIME_MAX_KEYWORD_QUERIES || 1)
    : Number(process.env.RETRIEVAL_MAX_KEYWORD_QUERIES || 3)

  const vectorSearchPromise = (async () => {
    const vectorStart = Date.now()
    const preferredVectorMatches = preferredFilter
      ? await vectorSearchFn({
          queryEmbedding: embeddingResult.embedding,
          topK: vectorTopK,
          indexName,
          filter: preferredFilter,
        })
      : []

    const fallbackVectorMatches = !hasPreferredFilterResults(preferredVectorMatches)
      ? await vectorSearchFn({
          queryEmbedding: embeddingResult.embedding,
          topK: vectorTopK,
          indexName,
        })
      : []

    return {
      vectorMatches: [...preferredVectorMatches, ...fallbackVectorMatches],
      vectorSearchTime: Date.now() - vectorStart,
    }
  })()

  const keywordSearchPromise = (async () => {
    const keywordStart = Date.now()
    const keywordQueries = normalizeArray([
      normalizedQuery,
      ...(expandedQueries || []),
    ]).slice(0, Math.max(1, keywordQueryLimit))

    const keywordMatchGroups = await Promise.all(
      keywordQueries.map(async (keywordQuery) => {
        const preferredResults = preferredFilter
          ? await keywordSearchFn({
              query: keywordQuery,
              topK: Math.ceil(keywordTopK * 0.7),
              filter: preferredFilter,
            })
          : []

        if (
          preferredResults.length &&
          preferredResults.length >= Math.ceil(keywordTopK * 0.4)
        ) {
          return preferredResults
        }

        const fallbackResults = await keywordSearchFn({
          query: keywordQuery,
          topK: Math.ceil(keywordTopK * 0.6),
        })

        return [...preferredResults, ...fallbackResults]
      }),
    )

    return {
      keywordMatches: keywordMatchGroups.flat(),
      keywordSearchTime: Date.now() - keywordStart,
    }
  })()

  const [{ vectorMatches, vectorSearchTime }, { keywordMatches, keywordSearchTime }] =
    await Promise.all([vectorSearchPromise, keywordSearchPromise])

  const metadataStart = Date.now()
  const metadataMatches = await metadataSearchFn({
    query: normalizedQuery || query,
    topK: Math.max(4, Math.ceil(keywordTopK * 0.4)),
  })
  const metadataSearchTime = Date.now() - metadataStart

  const documentStart = Date.now()
  const documentMatches = await documentSearchFn({
    query: normalizedQuery || query,
    topK: Math.max(4, Math.ceil(keywordTopK * 0.4)),
  })
  const documentSearchTime = Date.now() - documentStart

  const maxKeywordScore = Math.max(
    0,
    ...keywordMatches.map((match) => Number(match.keywordScore || 0)),
  )

  const merged = mergeExtendedCandidates({
    vectorMatches,
    keywordMatches,
    metadataMatches,
    documentMatches,
  }).map((candidate) => ({
    ...candidate,
    keywordScore: normalizeKeywordScore(candidate.keywordScore, maxKeywordScore),
  }))
    .filter((candidate) => {
      const semantic = Number(candidate.vectorScore ?? candidate.score ?? 0)
      const keyword = Number(candidate.keywordScore || 0)
      const metadataScore = Number(candidate.metadataScore || 0)
      const documentScore = Number(candidate.documentScore || 0)
      return (
        semantic >= RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE ||
        keyword > 0 ||
        metadataScore > 0 ||
        documentScore > 0
      )
    })

  const totalRetrievalTime = Date.now() - startTime

  const resultTopK = clampTopK(
    realtimeMode
      ? Number(process.env.RETRIEVAL_REALTIME_TOP_K || Math.min(RETRIEVAL_CONFIG.RAG_TOP_K, 12))
      : RETRIEVAL_CONFIG.RAG_TOP_K,
  )

  return {
    candidates: merged.slice(0, resultTopK),
    usage: {
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
    },
    metrics: {
      vectorSearchTime,
      keywordSearchTime,
      metadataSearchTime,
      documentSearchTime,
      totalRetrievalTime,
    },
  }
}
