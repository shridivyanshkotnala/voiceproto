import crypto from 'crypto'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { RESPONSE_DEFAULTS } from '../constants/response.constants.js'

// Validates request and delegates to language analysis service.
// Input: { message } and sessionId header
// Output: ApiResponse with analysis profile.
export async function analyzeLanguageController(req, res) {
  const { message } = req.body
  const sessionId = req.headers['x-session-id'] || crypto.randomUUID()

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'Message is required')
  }

  const hasDevanagari = /\p{Script=Devanagari}/u.test(message)
  const language = hasDevanagari ? 'hinglish' : 'english'

  const result = {
    language,
    hinglishStyle: RESPONSE_DEFAULTS.hinglishStyle,
    formality: RESPONSE_DEFAULTS.formality,
    complexity: RESPONSE_DEFAULTS.complexity,
    persona: RESPONSE_DEFAULTS.persona,
    preferredResponseStyle: RESPONSE_DEFAULTS.preferredResponseStyle,
    intent: 'general',
    confidence: 0,
    cleanedMessage: message.trim(),
    sessionId,
    usage: {
      model: 'unified-response',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
  }

  return res
    .status(200)
    .json(new ApiResponse(200, 'Language analysis successful', result))
}
