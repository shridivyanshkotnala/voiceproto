import OpenAI from 'openai'
import crypto from 'crypto'
import { ApiError } from '../utils/ApiError.js'
import {
  SHARED_STREAMING_SYSTEM_PROMPT,
  SHARED_SYSTEM_PROMPT,
} from '../prompts/sharedSystemPrompt.js'
import { UNIFIED_RESPONSE_PROMPT } from '../prompts/unifiedResponse.prompt.js'
import { calculateUsageCost } from './usageTracking.service.js'
import { ConversationProfile } from '../models/conversationProfile.model.js'
import { RESPONSE_DEFAULTS } from '../constants/response.constants.js'
import { postProcessTtsText } from './ttsTextPostProcessor.service.js'
import { estimateTokens } from '../utils/tokenBudget.util.js'

const OPENAI_TIMEOUT_MS = Number(
  process.env.OPENAI_COMPLETION_TIMEOUT_MS || 30000,
)
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 0)

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: OPENAI_TIMEOUT_MS,
    maxRetries: OPENAI_MAX_RETRIES,
  })
}

const FALLBACK_MESSAGE =
  'Ji Sir,\n\nMujhe available knowledge base me is query se related verified information nahi mili.'

const MAX_CONTEXT_CHARS = Number(process.env.MAX_CONTEXT_CHARS || 8000)
const MAX_HISTORY_CHARS = Number(process.env.MAX_HISTORY_CHARS || 1200)
const MAX_PROMPT_CHARS = Number(process.env.MAX_PROMPT_CHARS || 12000)

function normalizeString(value) {
  return String(value || '').trim().toLowerCase()
}

function normalizeLanguageProfile(profile = {}) {
  const language = ['english', 'hinglish'].includes(normalizeString(profile.language))
    ? normalizeString(profile.language)
    : RESPONSE_DEFAULTS.language

  const hinglishStyle = ['casual', 'business', 'technical'].includes(
    normalizeString(profile.hinglishStyle),
  )
    ? normalizeString(profile.hinglishStyle)
    : RESPONSE_DEFAULTS.hinglishStyle

  const tone = ['casual', 'professional', 'luxury'].includes(
    normalizeString(profile.tone),
  )
    ? normalizeString(profile.tone)
    : RESPONSE_DEFAULTS.formality

  const complexity = ['simple', 'medium', 'advanced'].includes(
    normalizeString(profile.complexity),
  )
    ? normalizeString(profile.complexity)
    : RESPONSE_DEFAULTS.complexity

  const persona = ['customer', 'salesperson', 'manager', 'business_owner'].includes(
    normalizeString(profile.persona),
  )
    ? normalizeString(profile.persona)
    : RESPONSE_DEFAULTS.persona

  return {
    language,
    hinglishStyle,
    tone,
    complexity,
    persona,
    preferredResponseStyle: RESPONSE_DEFAULTS.preferredResponseStyle,
    intent: String(profile.intent || 'general').trim() || 'general',
    confidence: Number.isFinite(profile.confidence)
      ? Math.min(Math.max(profile.confidence, 0), 1)
      : 0,
  }
}

function buildConversationHistory(history = []) {
  const transcript = history
    .slice(-5)
    .map((message, index) => {
      const role = normalizeString(message?.role || 'user')
      const content = String(message?.content || '').trim()
      if (!content) return null
      return `${index + 1}. ${role.toUpperCase()}: ${content}`
    })
    .filter(Boolean)
    .join('\n')

  if (MAX_HISTORY_CHARS > 0 && transcript.length > MAX_HISTORY_CHARS) {
    return transcript.slice(-MAX_HISTORY_CHARS)
  }

  return transcript
}

function safeParseJson(text) {
  const trimmed = String(text || '').trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd === -1) {
    return null
  }
  try {
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1))
  } catch (error) {
    return null
  }
}

function truncateContext(text) {
  if (!text) return ''
  if (!MAX_CONTEXT_CHARS || text.length <= MAX_CONTEXT_CHARS) return text
  return text.slice(0, MAX_CONTEXT_CHARS)
}

function buildUserContent({ userMessage, normalizedHistory, promptProfile, contextText, retrievalMetadata }) {
  return `Current User Query:\n${userMessage.trim()}\n\nLast 5 Messages:\n${
    normalizedHistory || 'None'
  }\n\nLanguage Profile (session defaults):\n${JSON.stringify(
    promptProfile || {},
  )}\n\nRetrieved Context:\n${contextText || 'NO_CONTEXT'}\n\nRetrieval Metadata:\n${JSON.stringify(
    retrievalMetadata || {},
  )}`
}

function buildStreamingUserContent({
  userMessage,
  normalizedHistory,
  promptProfile,
  contextText,
  retrievalMetadata,
}) {
  return `Current User Query:\n${userMessage.trim()}\n\nLast 5 Messages:\n${
    normalizedHistory || 'None'
  }\n\nLanguage Profile (session defaults):\n${JSON.stringify(
    promptProfile || {},
  )}\n\nRetrieved Context:\n${contextText || 'NO_CONTEXT'}\n\nRetrieval Metadata:\n${JSON.stringify(
    retrievalMetadata || {},
  )}\n\nInstructions:\n- Return ONLY final assistant answer as plain text.\n- Do not return JSON.\n- Keep business tone aligned with language profile.\n- Keep response concise, factual, and immediately useful.`
}

function extractStreamingDelta(chunk) {
  const content = chunk?.choices?.[0]?.delta?.content
  if (typeof content === 'string') {
    return content
  }
  return ''
}

async function upsertConversationProfile(sessionId, profile) {
  if (!sessionId) return null
  if (
    process.env.NODE_ENV === 'test' ||
    String(process.env.DISABLE_PROFILE_UPSERT).toLowerCase() === 'true'
  ) {
    return null
  }

  const normalized = normalizeLanguageProfile(profile)
  const existing = await ConversationProfile.findOne({ sessionId })

  if (!existing) {
    return ConversationProfile.create({
      sessionId,
      language: normalized.language,
      hinglishStyle: normalized.hinglishStyle,
      formality: normalized.tone,
      complexity: normalized.complexity,
      persona: normalized.persona,
      preferredResponseStyle: RESPONSE_DEFAULTS.preferredResponseStyle,
      lastIntent: normalized.intent,
      confidence: normalized.confidence,
    })
  }

  if (normalized.confidence >= (existing.confidence || 0)) {
    existing.language = normalized.language
    existing.hinglishStyle = normalized.hinglishStyle
    existing.formality = normalized.tone
    existing.complexity = normalized.complexity
    existing.persona = normalized.persona
    existing.preferredResponseStyle = RESPONSE_DEFAULTS.preferredResponseStyle
    existing.confidence = normalized.confidence
  }

  // Backfill required fields for legacy documents that may be missing schema-required keys.
  existing.language = existing.language || normalized.language || RESPONSE_DEFAULTS.language
  existing.hinglishStyle =
    existing.hinglishStyle || normalized.hinglishStyle || RESPONSE_DEFAULTS.hinglishStyle
  existing.formality =
    existing.formality || normalized.tone || RESPONSE_DEFAULTS.formality
  existing.complexity =
    existing.complexity || normalized.complexity || RESPONSE_DEFAULTS.complexity
  existing.persona = existing.persona || normalized.persona || RESPONSE_DEFAULTS.persona
  existing.preferredResponseStyle =
    existing.preferredResponseStyle || RESPONSE_DEFAULTS.preferredResponseStyle
  existing.confidence = Number.isFinite(existing.confidence)
    ? existing.confidence
    : normalized.confidence

  existing.lastIntent = normalized.intent
  await existing.save()
  return existing
}

function mockUnifiedResponse({
  userMessage,
  retrievalMetadata,
  sessionLanguageProfile,
  conversationHistory,
  retrievedContext,
}) {
  const promptProfile = normalizeLanguageProfile(sessionLanguageProfile)
  const historyCount = Array.isArray(conversationHistory)
    ? conversationHistory.slice(-5).length
    : 0
  const hasContext = String(retrievedContext || '').trim().length > 0
  if (!hasContext) {
    return {
      displayText: FALLBACK_MESSAGE,
      ttsText: FALLBACK_MESSAGE,
      languageProfile: promptProfile,
      retrievalInfo: {
        chunksUsed: 0,
        relevanceScore: 0,
      },
    }
  }
  return {
    displayText: userMessage
      ? `Ji Sir, ${userMessage} (history:${historyCount})`
      : FALLBACK_MESSAGE,
    ttsText: userMessage ? `जी सर, ${userMessage}` : FALLBACK_MESSAGE,
    languageProfile: promptProfile,
    retrievalInfo: {
      chunksUsed: Number(retrievalMetadata?.totalMatches || 0),
      relevanceScore: Number(retrievalMetadata?.averageScore || 0),
    },
  }
}

// Orchestrates unified OpenAI call for language analysis + response + TTS text.
// Input: { userMessage, conversationHistory, retrievedContext, sessionLanguageProfile, retrievalMetadata, sessionId }
// Output: unified response payload
export async function generateUnifiedResponse({
  userMessage,
  conversationHistory,
  retrievedContext,
  sessionLanguageProfile,
  retrievalMetadata,
  sessionId,
  latencyMetrics,
}) {
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    throw new ApiError(400, 'userMessage is required')
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const startedAt = Date.now()
  const normalizedHistory = buildConversationHistory(conversationHistory)
  let contextText = truncateContext(String(retrievedContext || '').trim())
  const promptProfile = sessionLanguageProfile || RESPONSE_DEFAULTS

  const systemContent = `${SHARED_SYSTEM_PROMPT}\n${UNIFIED_RESPONSE_PROMPT}`
  let userContent = buildUserContent({
    userMessage,
    normalizedHistory,
    promptProfile,
    contextText,
    retrievalMetadata,
  })

  if (MAX_PROMPT_CHARS > 0) {
    const baseSize = systemContent.length + userContent.length - contextText.length
    const maxContextLength = Math.max(0, MAX_PROMPT_CHARS - baseSize)
    if (contextText.length > maxContextLength) {
      contextText = contextText.slice(0, maxContextLength)
      userContent = buildUserContent({
        userMessage,
        normalizedHistory,
        promptProfile,
        contextText,
        retrievalMetadata,
      })
    }
  }

  const promptSize = systemContent.length + userContent.length
  const contextSize = contextText.length
  const chunkCount = Number(retrievalMetadata?.totalMatches || 0)
  const promptTokens = estimateTokens(`${systemContent}\n${userContent}`)
  const contextTokens = estimateTokens(contextText)

  const isMock =
    process.env.OPENAI_UNIFIED_MOCK === 'true' &&
    process.env.NODE_ENV === 'test'

  let openAiLatency = 0
  let parsed
  let usageSummary = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  }

  if (isMock) {
    const mockLatency = Number(process.env.OPENAI_UNIFIED_MOCK_LATENCY_MS || 20)
    if (mockLatency > 0) {
      await new Promise((resolve) => setTimeout(resolve, mockLatency))
    }
    parsed = mockUnifiedResponse({
      userMessage,
      retrievalMetadata,
      sessionLanguageProfile: promptProfile,
      conversationHistory,
      retrievedContext,
    })
  } else {
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError(500, 'OpenAI API key is not configured.')
    }

    const openAiStarted = Date.now()
    let response
    try {
      const openai = getOpenAIClient()
      response = await openai.chat.completions.create(
        {
          model,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
        },
        {
          timeout: OPENAI_TIMEOUT_MS,
          maxRetries: OPENAI_MAX_RETRIES,
        },
      )
    } catch (error) {
      const message = error?.message || 'Unified response request failed.'
      const isTimeout =
        error?.name === 'APIConnectionTimeoutError' || /timed out/i.test(message)

      if (isTimeout) {
        throw new ApiError(
          504,
          `Unified response timed out after ${OPENAI_TIMEOUT_MS}ms.`,
        )
      }

      throw new ApiError(502, `Unified response failed: ${message}`)
    }

    openAiLatency = Date.now() - openAiStarted
    const usage = response.usage || {}
    const inputTokens = usage.prompt_tokens || 0
    const outputTokens = usage.completion_tokens || 0
    usageSummary = calculateUsageCost({ model, inputTokens, outputTokens })

    const rawContent = response.choices?.[0]?.message?.content
    parsed = safeParseJson(rawContent)
  }

  if (!parsed) {
    parsed = mockUnifiedResponse({
      userMessage,
      retrievalMetadata,
      sessionLanguageProfile: promptProfile,
      conversationHistory,
      retrievedContext: contextText,
    })
  }

  const normalizedProfile = normalizeLanguageProfile(parsed?.languageProfile)
  const displayText = String(parsed?.displayText || '').trim() || FALLBACK_MESSAGE
  const rawTtsText = String(parsed?.ttsText || '').trim() || displayText
  const ttsText = postProcessTtsText(rawTtsText) || rawTtsText
  const retrievalInfo = {
    chunksUsed: Number(parsed?.retrievalInfo?.chunksUsed || chunkCount || 0),
    relevanceScore: Number(parsed?.retrievalInfo?.relevanceScore || retrievalMetadata?.averageScore || 0),
  }

  await upsertConversationProfile(sessionId, normalizedProfile)

  const totalGenerationTime = Date.now() - startedAt

  const usageRecord = {
    organizationId: 'default',
    sessionId: sessionId || 'anonymous',
    feature: 'unified_response',
    model,
    inputTokens: usageSummary.inputTokens,
    outputTokens: usageSummary.outputTokens,
    totalTokens: usageSummary.totalTokens,
    estimatedCost: usageSummary.estimatedCost,
    requestType: 'completion',
    provider: 'OpenAI',
    generationTime: totalGenerationTime,
    retrievalLatency: Number(latencyMetrics?.retrievalLatency || 0),
    generationLatency: Number(latencyMetrics?.generationLatency || totalGenerationTime || 0),
    totalPipelineLatency: Number(latencyMetrics?.totalPipelineLatency || 0),
    openAiLatency,
    promptSize,
    contextSize,
    chunkCount,
    promptTokens,
    contextTokens,
    retrievedChunks: Number(retrievalMetadata?.retrievedChunks || 0),
    rerankedChunks: Number(retrievalMetadata?.rerankedChunks || 0),
    finalChunks: Number(retrievalMetadata?.finalChunks || chunkCount || 0),
    compressionRatio: Number(retrievalMetadata?.compressionRatio || 0),
  }

  console.info('[unified-response]', {
    query: userMessage,
    retrievedChunks: Number(retrievalMetadata?.retrievedChunks || 0),
    rerankedChunks: Number(retrievalMetadata?.rerankedChunks || 0),
    finalChunks: Number(retrievalMetadata?.finalChunks || chunkCount || 0),
    promptSize,
    contextSize,
    promptTokens,
    contextTokens,
    compressionRatio: Number(retrievalMetadata?.compressionRatio || 0),
    chunkCount,
    openAiLatency,
    generationLatency: totalGenerationTime,
    totalGenerationTime,
    estimatedCost: usageSummary.estimatedCost,
  })

  return {
    displayText,
    ttsText,
    languageProfile: normalizedProfile,
    retrievalInfo,
    usage: {
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
    },
    usageRecord,
    metrics: {
      openAiLatency,
      totalGenerationTime,
      promptTokens,
      contextTokens,
    },
    sessionId: sessionId || crypto.randomUUID(),
  }
}

// Generates OpenAI token stream for low-latency response delivery.
// Input: same payload as generateUnifiedResponse + optional AbortSignal
// Output: { stream, languageProfile, sessionId, model, startedAt, contextMeta }
export async function generateStreamingResponse({
  userMessage,
  conversationHistory,
  retrievedContext,
  sessionLanguageProfile,
  retrievalMetadata,
  sessionId,
  signal,
}) {
  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    throw new ApiError(400, 'userMessage is required')
  }

  const model =
    process.env.REALTIME_OPENAI_MODEL ||
    process.env.OPENAI_MODEL ||
    'gpt-4o-mini'

  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError(500, 'OpenAI API key is not configured.')
  }

  const normalizedHistory = buildConversationHistory(conversationHistory)
  let contextText = truncateContext(String(retrievedContext || '').trim())
  const promptProfile = sessionLanguageProfile || RESPONSE_DEFAULTS

  const systemContent = `${SHARED_STREAMING_SYSTEM_PROMPT}\n${UNIFIED_RESPONSE_PROMPT}`
  let userContent = buildStreamingUserContent({
    userMessage,
    normalizedHistory,
    promptProfile,
    contextText,
    retrievalMetadata,
  })

  if (MAX_PROMPT_CHARS > 0) {
    const baseSize = systemContent.length + userContent.length - contextText.length
    const maxContextLength = Math.max(0, MAX_PROMPT_CHARS - baseSize)
    if (contextText.length > maxContextLength) {
      contextText = contextText.slice(0, maxContextLength)
      userContent = buildStreamingUserContent({
        userMessage,
        normalizedHistory,
        promptProfile,
        contextText,
        retrievalMetadata,
      })
    }
  }

  const openai = getOpenAIClient()
  const startedAt = Date.now()

  let responseStream
  try {
    responseStream = await openai.chat.completions.create(
      {
        model,
        temperature: 0.2,
        stream: true,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
      },
      {
        timeout: OPENAI_TIMEOUT_MS,
        maxRetries: OPENAI_MAX_RETRIES,
        signal,
      },
    )
  } catch (error) {
    const message = error?.message || 'Streaming response request failed.'
    const isTimeout =
      error?.name === 'APIConnectionTimeoutError' || /timed out/i.test(message)

    if (isTimeout) {
      throw new ApiError(
        504,
        `Streaming response timed out after ${OPENAI_TIMEOUT_MS}ms.`,
      )
    }

    throw new ApiError(502, `Streaming response failed: ${message}`)
  }

  const normalizedProfile = normalizeLanguageProfile(promptProfile)
  await upsertConversationProfile(sessionId, normalizedProfile)

  async function* tokenGenerator() {
    for await (const chunk of responseStream) {
      const token = extractStreamingDelta(chunk)
      if (token) {
        yield token
      }
    }
  }

  return {
    stream: tokenGenerator(),
    languageProfile: normalizedProfile,
    sessionId,
    model,
    startedAt,
    contextMeta: {
      chunkCount: Number(retrievalMetadata?.totalMatches || 0),
      averageScore: Number(retrievalMetadata?.averageScore || 0),
    },
  }
}
