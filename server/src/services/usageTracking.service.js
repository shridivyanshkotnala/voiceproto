import { AiUsage } from '../models/aiUsage.model.js'
import { AI_PRICING } from '../constants/aiPricing.constants.js'
import { ApiError } from '../utils/ApiError.js'

// Calculates token usage costs using pricing constants.
// Input: model, inputTokens, outputTokens
// Output: token totals + estimatedCost
export function calculateUsageCost({ model, inputTokens, outputTokens }) {
  const pricing = AI_PRICING[model]
  if (!pricing) {
    throw new ApiError(500, `Pricing not configured for model: ${model}`)
  }

  const totalTokens = inputTokens + outputTokens
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion
  const estimatedCost = Number((inputCost + outputCost).toFixed(8))

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedCost,
  }
}

// Persists a usage record for analytics and billing.
// Input: usage payload
// Output: saved usage record
export async function saveUsageRecord(payload) {
  return AiUsage.create(payload)
}

// Aggregates usage analytics across records.
// Input: optional filters
// Output: summary metrics
export async function getUsageSummary(filter = {}) {
  const [summary] = await AiUsage.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        totalInputTokens: { $sum: '$inputTokens' },
        totalOutputTokens: { $sum: '$outputTokens' },
        totalTokens: { $sum: '$totalTokens' },
        totalEstimatedCost: { $sum: '$estimatedCost' },
      },
    },
    {
      $project: {
        _id: 0,
        totalRequests: 1,
        totalInputTokens: 1,
        totalOutputTokens: 1,
        totalTokens: 1,
        totalEstimatedCost: { $round: ['$totalEstimatedCost', 6] },
      },
    },
  ])

  return (
    summary || {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      totalEstimatedCost: 0,
    }
  )
}
