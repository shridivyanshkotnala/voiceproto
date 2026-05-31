import OpenAI from 'openai'
import { ApiError } from '../utils/ApiError.js'
import { optimizeTokens } from '../utils/pronunciationHelpers.js'
import { BUSINESS_WORD_WHITELIST } from '../constants/pronunciation.constants.js'
import { PRONUNCIATION_OPTIMIZATION_PROMPT } from '../prompts/pronunciationOptimization.prompt.js'
import { calculateUsageCost, saveUsageRecord } from './usageTracking.service.js'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

function isUsageTrackingDisabled() {
  return String(process.env.DISABLE_USAGE_TRACKING).toLowerCase() === 'true'
}

function sanitizeModelText(rawText) {
  if (typeof rawText !== 'string') return ''

  let text = rawText.trim()
  if (!text) return ''

  const fencedMatch = text.match(/^```(?:json|text)?\s*([\s\S]*?)\s*```$/i)
  if (fencedMatch?.[1]) {
    text = fencedMatch[1].trim()
  }

  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text)
      const extracted =
        parsed?.ttsOptimizedResponse ||
        parsed?.optimizedText ||
        parsed?.text ||
        parsed?.output

      if (typeof extracted === 'string' && extracted.trim()) {
        text = extracted.trim()
      }
    } catch {
      // Ignore parsing failures and continue with raw text.
    }
  }

  text = text.replace(/^optimized\s*text\s*:\s*/i, '').trim()
  text = text.replace(/^"([\s\S]*)"$/, '$1').trim()

  return text
}

function looksCorrupted(text) {
  return /�/.test(text)
}

function getBusinessWords(text) {
  const tokens = text.match(/[A-Za-z.]+/g) || []
  return new Set(
    tokens
      .map((token) => token.toLowerCase())
      .filter((token) => BUSINESS_WORD_WHITELIST.has(token)),
  )
}

function shouldFallbackToDeterministic({ sourceText, candidateText }) {
  if (!candidateText || looksCorrupted(candidateText)) {
    return true
  }

  const sourceBusinessWords = getBusinessWords(sourceText)
  if (sourceBusinessWords.size === 0) {
    return false
  }

  const candidateBusinessWords = getBusinessWords(candidateText)

  for (const businessWord of sourceBusinessWords) {
    if (!candidateBusinessWords.has(businessWord)) {
      return true
    }
  }

  return false
}

async function safeSaveUsageRecord(payload) {
  if (isUsageTrackingDisabled()) {
    return
  }

  try {
    await saveUsageRecord(payload)
  } catch (error) {
    console.warn(
      '[pronunciation] usage tracking skipped:',
      error?.message || error,
    )
  }
}

// Optimizes text for TTS pronunciation while preserving meaning.
// Input: { responseText, languageProfile }
// Output: { originalResponse, ttsOptimizedResponse }
export async function optimizePronunciation({ responseText, languageProfile }) {
  if (!responseText || typeof responseText !== 'string') {
    throw new ApiError(400, 'Response text is required')
  }

  const trimmed = responseText.trim()
  if (!trimmed) {
    throw new ApiError(400, 'Response text is required')
  }

  const language = languageProfile?.language || 'english'

  const model = process.env.OPENAI_PRONUNCIATION_MODEL || 'gpt-4o-mini'
  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError(500, 'OpenAI API key is not configured.')
  }

  const isMock =
    process.env.OPENAI_PRONUNCIATION_MOCK === 'true' &&
    process.env.NODE_ENV === 'test'

  if (isMock) {
    const ttsOptimizedResponse = optimizeTokens({
      text: trimmed,
      language,
    })

    await safeSaveUsageRecord({
      organizationId: 'default',
      sessionId: 'pronunciation-mock',
      feature: 'pronunciation_optimization',
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      requestType: 'completion',
    })

    return {
      originalResponse: trimmed,
      ttsOptimizedResponse,
      usage: {
        model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        provider: 'OpenAI',
        isMock: true,
      },
    }
  }

  const openai = getOpenAIClient()
  const response = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    messages: [
      { role: 'system', content: PRONUNCIATION_OPTIMIZATION_PROMPT },
      {
        role: 'user',
        content: `Language: ${language}\nText:\n${trimmed}`,
      },
    ],
  })

  const optimizedText = sanitizeModelText(
    response.choices?.[0]?.message?.content,
  )

  if (!optimizedText) {
    throw new ApiError(502, 'Pronunciation optimization failed.')
  }

  const baseTextForFallback = shouldFallbackToDeterministic({
    sourceText: trimmed,
    candidateText: optimizedText,
  })
    ? trimmed
    : optimizedText

  const finalOptimizedText = optimizeTokens({
    text: baseTextForFallback,
    language,
  })

  const usage = response.usage || {}
  const inputTokens = usage.prompt_tokens || 0
  const outputTokens = usage.completion_tokens || 0
  const usageSummary = calculateUsageCost({ model, inputTokens, outputTokens })

  await safeSaveUsageRecord({
    organizationId: 'default',
    sessionId: 'pronunciation',
    feature: 'pronunciation_optimization',
    model,
    inputTokens: usageSummary.inputTokens,
    outputTokens: usageSummary.outputTokens,
    totalTokens: usageSummary.totalTokens,
    estimatedCost: usageSummary.estimatedCost,
    requestType: 'completion',
  })

  return {
    originalResponse: trimmed,
    ttsOptimizedResponse: finalOptimizedText,
    usage: {
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
      provider: 'OpenAI',
      isMock: false,
    },
  }
}