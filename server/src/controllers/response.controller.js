import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { runRetrieval } from '../services/retrieval.layer.service.js'
import { generateBusinessAnswer } from '../services/responseGeneration.service.js'
import { adaptAnswerLanguage } from '../services/hinglishPreservation.service.js'
import { resolveConversationProfile } from '../services/conversationMemory.service.js'

// Orchestrates retrieval, response generation, and language adaptation.
// Input: { question, sessionId }
// Output: final answer + language metadata
export const generateResponseController = asyncHandler(async (req, res) => {
  const { question, sessionId } = req.body

  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new ApiError(400, 'Question is required')
  }

  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new ApiError(400, 'SessionId is required')
  }

  const retrievalResult = await runRetrieval({
    query: question.trim(),
    sessionId: sessionId.trim(),
  })

  const memoryProfile = await resolveConversationProfile(sessionId.trim())
  const languageProfile = {
    ...memoryProfile,
    ...(retrievalResult.languageProfile || {}),
  }

  const { answer } = await generateBusinessAnswer({
    question: question.trim(),
    context: retrievalResult.context,
    languageProfile,
    sessionId: sessionId.trim(),
  })

  const { adaptedAnswer } = await adaptAnswerLanguage({
    answer,
    languageProfile,
    sessionId: sessionId.trim(),
  })


  const style =
    languageProfile.language === 'hinglish'
      ? languageProfile.hinglishStyle
      : languageProfile.preferredResponseStyle

  return res.status(200).json(
    new ApiResponse(200, 'Response generated', {
      answer: adaptedAnswer,
      languageProfile,
      language: languageProfile.language,
      persona: languageProfile.persona,
      style,
    }),
  )
})
