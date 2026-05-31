import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { runRetrieval } from '../services/retrieval.layer.service.js'

// Accepts query and returns retrieval context.
// Input: { query, sessionId }
// Output: retrieval payload
export const retrievalSearchController = asyncHandler(async (req, res) => {
  const { query, sessionId } = req.body
  const result = await runRetrieval({ query, sessionId })

  return res
    .status(200)
    .json(new ApiResponse(200, 'Retrieval completed', result))
})
