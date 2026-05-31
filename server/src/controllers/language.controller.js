import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { analyzeLanguage } from '../services/language.service.js'

// Validates request and delegates to language analysis service.
// Input: { message } and sessionId header
// Output: ApiResponse with analysis profile.
export async function analyzeLanguageController(req, res) {
  const { message } = req.body
  const sessionId = req.headers['x-session-id']

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'Message is required')
  }

  const result = await analyzeLanguage({
    message: message.trim(),
    sessionId,
  })

  return res
    .status(200)
    .json(new ApiResponse(200, 'Language analysis successful', result))
}
