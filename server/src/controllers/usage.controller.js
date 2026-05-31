import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getUsageSummary } from '../services/usageTracking.service.js'

// Returns aggregated AI usage analytics.
// Input: query filters (future)
// Output: summary metrics
export const getUsageSummaryController = asyncHandler(async (req, res) => {
  const summary = await getUsageSummary()

  return res
    .status(200)
    .json(new ApiResponse(200, 'Usage summary fetched', summary))
})
