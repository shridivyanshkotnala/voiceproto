import crypto from 'crypto'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { runRetrieval } from '../services/retrieval.layer.service.js'
import { resolveConversationProfile } from '../services/conversationMemory.service.js'
import { generateUnifiedResponse } from '../services/responseOrchestrator.service.js'
import { saveUsageRecord } from '../services/usageTracking.service.js'
import {
  buildControlledUncertaintyMessage,
  validateGrounding,
} from '../services/groundingValidator.service.js'
import { evaluateAnswerQuality } from '../services/answerEvaluator.service.js'
import { postProcessTtsText } from '../services/ttsTextPostProcessor.service.js'

// Orchestrates retrieval, response generation, and language adaptation.
// Input: { question, sessionId }
// Output: final answer + language metadata
export const generateResponseController = asyncHandler(async (req, res) => {
  const { question, sessionId, conversationHistory } = req.body

  if (!question || typeof question !== 'string' || !question.trim()) {
    throw new ApiError(400, 'Question is required')
  }

  const resolvedSessionId =
    sessionId && typeof sessionId === 'string' && sessionId.trim()
      ? sessionId.trim()
      : crypto.randomUUID()

  const startedAt = Date.now()
  const retrievalStart = Date.now()

  const retrievalResult = await runRetrieval({
    query: question.trim(),
    sessionId: resolvedSessionId,
    conversationHistory: Array.isArray(conversationHistory)
      ? conversationHistory.slice(-5)
      : [],
  })

  const retrievalLatency = Date.now() - retrievalStart

  const memoryProfile = await resolveConversationProfile(resolvedSessionId)
  const languageProfile = {
    ...memoryProfile,
    ...(retrievalResult.languageProfile || {}),
  }

  const grounding = validateGrounding({
    retrievalResult,
    queryIntelligence: retrievalResult.queryIntelligence,
  })

  let unified

  if (grounding.lowConfidence) {
    const controlledAnswer = buildControlledUncertaintyMessage({
      query: question.trim(),
      language: languageProfile.language,
    })
    const fallbackLanguage = languageProfile?.language || 'hinglish'

    unified = {
      displayText: controlledAnswer,
      ttsText:
        postProcessTtsText(controlledAnswer, {
          language: fallbackLanguage,
        }) || controlledAnswer,
      languageProfile: {
        ...languageProfile,
        language: fallbackLanguage,
        persona: languageProfile?.persona || 'manager',
        preferredResponseStyle:
          languageProfile?.preferredResponseStyle || 'structured_response',
        hinglishStyle: languageProfile?.hinglishStyle || 'business',
      },
      retrievalInfo: {
        chunksUsed: retrievalResult?.retrieval?.totalMatches || 0,
        relevanceScore: retrievalResult?.retrievalScore || 0,
      },
      usage: {
        model: 'grounding_guardrail',
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
      usageRecord: null,
      metrics: {
        openAiLatency: 0,
        totalGenerationTime: 0,
        promptTokens: 0,
        contextTokens: retrievalResult?.metrics?.contextTokens || 0,
      },
      sessionId: resolvedSessionId,
    }
  } else {
    unified = await generateUnifiedResponse({
      userMessage: question.trim(),
      conversationHistory: Array.isArray(conversationHistory)
        ? conversationHistory.slice(-5)
        : [],
      retrievedContext: retrievalResult.context,
      sessionLanguageProfile: languageProfile,
      retrievalMetadata: {
        totalMatches: retrievalResult?.retrieval?.totalMatches || 0,
        averageScore: retrievalResult?.retrieval?.averageScore || 0,
        citations: retrievalResult?.citations || [],
        sourceChunks: retrievalResult?.sourceChunks || [],
        retrievedChunks: retrievalResult?.debug?.rawMatches || 0,
        rerankedChunks: retrievalResult?.optimizer?.stats?.rerankedChunks || 0,
        finalChunks: retrievalResult?.optimizer?.stats?.finalChunks || 0,
        compressionRatio: retrievalResult?.optimizer?.stats?.compressionRatio || 0,
        contextTokens: retrievalResult?.metrics?.contextTokens || 0,
      },
      sessionId: resolvedSessionId,
      latencyMetrics: {
        retrievalLatency,
      },
    })
  }

  const answerQuality = evaluateAnswerQuality({
    answer: unified.displayText,
    query: question.trim(),
    retrievalResult,
    grounding,
    queryIntelligence: retrievalResult.queryIntelligence,
  })

  const totalPipelineLatency = Date.now() - startedAt
  const disableUsageTracking =
    String(process.env.DISABLE_USAGE_TRACKING).toLowerCase() === 'true' ||
    process.env.NODE_ENV === 'test'

  if (!disableUsageTracking && unified.usageRecord) {
    await saveUsageRecord({
      ...unified.usageRecord,
      generationLatency: unified.metrics?.totalGenerationTime || 0,
      totalPipelineLatency,
    })
  }

  return res.status(200).json(
    new ApiResponse(200, 'Response generated', {
      answer: unified.displayText,
      ttsText: unified.ttsText,
      languageProfile: unified.languageProfile,
      language: unified.languageProfile.language,
      persona: unified.languageProfile.persona,
      style:
        unified.languageProfile.language === 'hinglish'
          ? unified.languageProfile.hinglishStyle
          : unified.languageProfile.preferredResponseStyle,
      retrievalInfo: unified.retrievalInfo,
      citations: retrievalResult.citations || [],
      sourceChunksUsed: retrievalResult.sourceChunksUsed || [],
      retrievalScore: retrievalResult.retrievalScore || 0,
      retrievalConfidence: grounding.retrievalConfidence,
      contextConfidence: grounding.contextConfidence,
      groundingScore: grounding.groundingScore,
      confidenceTier: grounding.confidenceTier,
      lowConfidence: grounding.lowConfidence,
      queryIntelligence: retrievalResult.queryIntelligence || null,
      answerQuality,
      usage: unified.usage,
      metrics: {
        ...unified.metrics,
        retrievalLatency,
        totalPipelineLatency,
      },
      sessionId: resolvedSessionId,
    }),
  )
})
