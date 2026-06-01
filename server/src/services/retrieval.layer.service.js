import { ConversationProfile } from '../models/conversationProfile.model.js'
import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'
import { ApiError } from '../utils/ApiError.js'
import { generateEmbedding } from './embedding.service.js'
import { searchSimilarChunks } from './vectorStore.service.js'
import { filterRelevantMatches } from './relevanceFilter.service.js'
import { buildContext } from './contextBuilder.service.js'
import { calculateUsageCost, saveUsageRecord } from './usageTracking.service.js'

function parseVectorDimensionMismatch(error) {
  const message = error?.message || ''
  const match = message.match(/indexed with\s+(\d+)\s+dimensions\s+but queried with\s+(\d+)/i)
  if (!match) {
    return null
  }

  return {
    indexedDimensions: Number(match[1]),
    queriedDimensions: Number(match[2]),
  }
}

// Orchestrates retrieval flow for RAG context.
// Input: query, sessionId
// Output: retrieval payload with context
export async function runRetrieval({ query, sessionId }) {
  if (!query || !query.trim()) {
    throw new ApiError(400, 'Query is required')
  }

  const profile = sessionId
    ? await ConversationProfile.findOne({ sessionId }).lean()
    : null

  let { embedding, usage, model } = await generateEmbedding(query)

  const inputTokens = usage.prompt_tokens || usage.total_tokens || 0
  const outputTokens = usage.completion_tokens || 0
  const usageSummary = calculateUsageCost({ model, inputTokens, outputTokens })

  await saveUsageRecord({
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

  const indexName = process.env.VECTOR_SEARCH_INDEX
  if (!indexName) {
    throw new ApiError(500, 'VECTOR_SEARCH_INDEX is not configured.')
  }

  let rawMatches
  try {
    rawMatches = await searchSimilarChunks({
      queryEmbedding: embedding,
      topK: RETRIEVAL_CONFIG.TOP_K_RESULTS,
      indexName,
    })
  } catch (error) {
    const mismatch = parseVectorDimensionMismatch(error)
    if (!mismatch) {
      throw error
    }

    const retriedEmbedding = await generateEmbedding(query, {
      dimensions: mismatch.indexedDimensions,
    })
    embedding = retriedEmbedding.embedding
    usage = retriedEmbedding.usage
    model = retriedEmbedding.model

    rawMatches = await searchSimilarChunks({
      queryEmbedding: embedding,
      topK: RETRIEVAL_CONFIG.TOP_K_RESULTS,
      indexName,
    })
  }

  const filteredMatches = filterRelevantMatches(rawMatches)
  const context = buildContext(filteredMatches)

  const averageScore = filteredMatches.length
    ? Number(
        (
          filteredMatches.reduce((sum, match) => sum + match.score, 0) /
          filteredMatches.length
        ).toFixed(3),
      )
    : 0

  const retrieval = {
    totalMatches: filteredMatches.length,
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
    usage: usageSummary,
  }

  if (!context) {
    response.message = 'No relevant context found.'
  }

  if (process.env.NODE_ENV !== 'production') {
    response.debug = {
      queryEmbeddingGenerated: true,
      rawMatches: rawMatches.length,
      filteredMatches: filteredMatches.length,
      averageSimilarity: averageScore,
    }
  }

  return response
}
