import { DEFAULT_TOP_K } from '../constants/rag.constants.js'
import { ApiError } from '../utils/ApiError.js'
import { generateEmbedding } from './embedding.service.js'
import { searchSimilarChunks } from './vectorStore.service.js'
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

// Retrieves top matching knowledge chunks for a query.
// Input: query, topK, sessionId
// Output: matches array
export async function retrieveRelevantContext({ query, topK, sessionId }) {
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

  let matches
  try {
    matches = await searchSimilarChunks({
      queryEmbedding: embedding,
      topK: topK || DEFAULT_TOP_K,
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

    matches = await searchSimilarChunks({
      queryEmbedding: embedding,
      topK: topK || DEFAULT_TOP_K,
      indexName,
    })
  }

  return {
    matches,
    usage: {
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
    },
  }
}
