import { DEFAULT_TOP_K } from '../constants/rag.constants.js'
import { ApiError } from '../utils/ApiError.js'
import { generateEmbedding } from './embedding.service.js'
import { searchSimilarChunks } from './vectorStore.service.js'
import { calculateUsageCost, saveUsageRecord } from './usageTracking.service.js'

// Retrieves top matching knowledge chunks for a query.
// Input: query, topK, sessionId
// Output: matches array
export async function retrieveRelevantContext({ query, topK, sessionId }) {
  const { embedding, usage, model } = await generateEmbedding(query)

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

  const matches = await searchSimilarChunks({
    queryEmbedding: embedding,
    topK: topK || DEFAULT_TOP_K,
    indexName,
  })

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
