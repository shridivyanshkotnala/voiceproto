import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  ingestKnowledgeDocument,
  searchKnowledge,
  getKnowledgeStats,
} from '../services/knowledge.service.js'

// Handles knowledge document upload and ingestion.
// Input: multipart/form-data file + sessionId
// Output: document metadata
export const uploadKnowledgeController = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Knowledge file is required')
  }

  const sessionId = req.headers['x-session-id']
  const document = await ingestKnowledgeDocument({
    file: req.file,
    sessionId,
  })

  return res
    .status(201)
    .json(new ApiResponse(201, 'Knowledge uploaded', document))
})

// Handles semantic search queries.
// Input: { query, topK }
// Output: top matching chunks
export const searchKnowledgeController = asyncHandler(async (req, res) => {
  const { query, topK } = req.body
  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Query is required')
  }

  const sessionId = req.headers['x-session-id']
  const result = await searchKnowledge({
    query: query.trim(),
    topK,
    sessionId,
  })

  return res.status(200).json(
    new ApiResponse(200, 'Knowledge retrieved', {
      query,
      matches: result.matches.map((match) => ({
        chunkText: match.chunkText,
        score: match.score,
        metadata: match.metadata,
      })),
      usage: result.usage,
    }),
  )
})

// Returns aggregated knowledge stats.
// Input: none
// Output: total documents and chunk counts
export const getKnowledgeStatsController = asyncHandler(async (req, res) => {
  const stats = await getKnowledgeStats()
  return res.status(200).json(new ApiResponse(200, 'Knowledge stats', stats))
})
