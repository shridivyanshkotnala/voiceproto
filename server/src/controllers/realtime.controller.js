import crypto from 'crypto'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getIceConfig } from '../services/webrtc.service.js'

export const getRealtimeConfigController = asyncHandler(async (req, res) => {
  const sessionId = crypto.randomUUID()
  const config = getIceConfig()

  return res.status(200).json(
    new ApiResponse(200, 'Realtime config', {
      sessionId,
      iceServers: config.iceServers,
    }),
  )
})
