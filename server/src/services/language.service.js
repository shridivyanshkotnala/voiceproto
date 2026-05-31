import crypto from 'crypto'
import OpenAI from 'openai'
import { ApiError } from '../utils/ApiError.js'
import {
  COMPLEXITY_LEVELS,
  FORMALITY_LEVELS,
  HINGLISH_STYLES,
  LANGUAGES,
  PERSONAS,
  RESPONSE_STYLES,
} from '../constants/language.constants.js'
import { LANGUAGE_ANALYSIS_PROMPT } from '../prompts/languageAnalysis.prompt.js'
import { ConversationProfile } from '../models/conversationProfile.model.js'
import { calculateUsageCost, saveUsageRecord } from './usageTracking.service.js'

const OPENAI_TIMEOUT_MS = Number(
  process.env.OPENAI_COMPLETION_TIMEOUT_MS || 30000,
)
const OPENAI_MAX_RETRIES = Number(process.env.OPENAI_MAX_RETRIES || 0)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
  maxRetries: OPENAI_MAX_RETRIES,
})

// Normalizes string values to lowercase tokens.
// Input: value
// Output: lowercase string
function normalizeString(value) {
  return String(value || '').trim().toLowerCase()
}

function mapLanguage(value) {
  const normalized = normalizeString(value)
  if (['en', 'english'].includes(normalized)) return 'english'
  if (['hi-en', 'hinglish', 'hindi-english', 'hindi english', 'hindi+english'].includes(normalized)) {
    return 'hinglish'
  }
  return normalized
}

function mapHinglishStyle(value) {
  const normalized = normalizeString(value)
  if (['biz', 'business', 'professional'].includes(normalized)) return 'business'
  if (['casual', 'informal'].includes(normalized)) return 'casual'
  if (['technical', 'tech'].includes(normalized)) return 'technical'
  return normalized
}

function mapFormality(value) {
  const normalized = normalizeString(value)
  if (['professional', 'business'].includes(normalized)) return 'professional'
  if (['luxury', 'premium'].includes(normalized)) return 'luxury'
  if (['casual', 'informal'].includes(normalized)) return 'casual'
  return normalized
}

function mapComplexity(value) {
  const normalized = normalizeString(value)
  if (['simple', 'basic'].includes(normalized)) return 'simple'
  if (['medium', 'moderate'].includes(normalized)) return 'medium'
  if (['advanced', 'complex'].includes(normalized)) return 'advanced'
  return normalized
}

function mapPersona(value) {
  const normalized = normalizeString(value)
  if (['owner', 'business owner', 'business_owner'].includes(normalized)) return 'business_owner'
  if (['sales', 'salesperson', 'sales person'].includes(normalized)) return 'salesperson'
  if (['manager', 'store manager'].includes(normalized)) return 'manager'
  if (['customer', 'client'].includes(normalized)) return 'customer'
  return normalized
}

function mapResponseStyle(value) {
  const normalized = normalizeString(value)
  if (['same_as_user', 'same as user', 'mirror'].includes(normalized)) return 'same_as_user'
  if (['professional_hinglish', 'professional hinglish'].includes(normalized)) return 'professional_hinglish'
  if (['professional_english', 'professional english'].includes(normalized)) return 'professional_english'
  if (['luxury_business', 'luxury business', 'luxury'].includes(normalized)) return 'luxury_business'
  return normalized
}

// Cleans Hinglish transliteration artifacts into readable text.
// Input: raw text
// Output: beautified Hinglish text
function cleanHinglishText(text) {
  const normalized = text
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()

  const lowered = normalized.toLowerCase()

  const cleaned = lowered
    .replace(/\.n/g, 'n')
    .replace(/\.m/g, 'm')
    .replace(/\.h/g, 'h')
    .replace(/\bnahim\b/g, 'nahi')
    .replace(/\bnahii\b/g, 'nahi')
    .replace(/\bmaim\b/g, 'main')
    .replace(/\bmein\b/g, 'main')
    .replace(/\bhu\.n\b/g, 'hoon')
    .replace(/\bhun\b/g, 'hoon')
    .replace(/\bkya hai\b/g, 'kya hai')

  return cleaned.replace(/\b([a-z])\1{2,}\b/g, '$1$1')
}

// Safely parses JSON from model output.
// Input: raw model output
// Output: parsed JSON object
function safeParseJson(text) {
  const trimmed = text.trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new ApiError(502, 'Invalid response from language model.')
  }

  try {
    return JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1))
  } catch (error) {
    throw new ApiError(502, 'Unable to parse language model response.')
  }
}

// Validates analysis output against allowed enums.
// Input: analysis payload
// Output: throws ApiError if invalid
function validateAnalysis(payload) {
  if (!LANGUAGES.includes(payload.language)) {
    throw new ApiError(422, 'Invalid language detected')
  }
  if (!HINGLISH_STYLES.includes(payload.hinglishStyle)) {
    throw new ApiError(422, 'Invalid hinglish style detected')
  }
  if (!FORMALITY_LEVELS.includes(payload.formality)) {
    throw new ApiError(422, 'Invalid formality level detected')
  }
  if (!COMPLEXITY_LEVELS.includes(payload.complexity)) {
    throw new ApiError(422, 'Invalid complexity level detected')
  }
  if (!PERSONAS.includes(payload.persona)) {
    throw new ApiError(422, 'Invalid persona detected')
  }
  if (!RESPONSE_STYLES.includes(payload.preferredResponseStyle)) {
    throw new ApiError(422, 'Invalid response style detected')
  }
}

function inferLanguageFromMessage(message) {
  const hasDevanagari = /\p{Script=Devanagari}/u.test(message)
  if (hasDevanagari) {
    return 'hinglish'
  }
  return 'english'
}

// Upserts conversation profile with confidence-aware updates.
// Input: sessionId, analysis
// Output: saved ConversationProfile
async function upsertProfile(sessionId, analysis) {
  const existing = await ConversationProfile.findOne({ sessionId })

  if (!existing) {
    return ConversationProfile.create({
      sessionId,
      language: analysis.language,
      hinglishStyle: analysis.hinglishStyle,
      formality: analysis.formality,
      complexity: analysis.complexity,
      persona: analysis.persona,
      preferredResponseStyle: analysis.preferredResponseStyle,
      lastIntent: analysis.intent,
      confidence: analysis.confidence,
    })
  }

  if (analysis.confidence >= existing.confidence) {
    existing.language = analysis.language
    existing.hinglishStyle = analysis.hinglishStyle
    existing.formality = analysis.formality
    existing.complexity = analysis.complexity
    existing.persona = analysis.persona
    existing.preferredResponseStyle = analysis.preferredResponseStyle
    existing.confidence = analysis.confidence
  }

  existing.lastIntent = analysis.intent
  await existing.save()

  return existing
}

// Calls OpenAI and persists language intelligence profile.
// Input: message and sessionId
// Output: analysis profile + cleanedMessage
export async function analyzeLanguage({ message, sessionId }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError(500, 'OpenAI API key is not configured.')
  }

  const model = process.env.OPENAI_MODEL
  if (!model) {
    throw new ApiError(500, 'OpenAI model is not configured.')
  }

  let response
  try {
    response = await openai.chat.completions.create(
      {
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: LANGUAGE_ANALYSIS_PROMPT },
          { role: 'user', content: message },
        ],
      },
      {
        timeout: OPENAI_TIMEOUT_MS,
        maxRetries: OPENAI_MAX_RETRIES,
      },
    )
  } catch (error) {
    const message = error?.message || 'Language model request failed.'
    const isTimeout =
      error?.name === 'APIConnectionTimeoutError' || /timed out/i.test(message)

    if (isTimeout) {
      throw new ApiError(
        504,
        `Language analysis timed out after ${OPENAI_TIMEOUT_MS}ms.`,
      )
    }

    throw new ApiError(502, `Language analysis failed: ${message}`)
  }

  const usage = response.usage || {}
  const inputTokens = usage.prompt_tokens || 0
  const outputTokens = usage.completion_tokens || 0
  const usageSummary = calculateUsageCost({
    model,
    inputTokens,
    outputTokens,
  })

  const content = response.choices?.[0]?.message?.content || ''
  const analysis = safeParseJson(content)

  const normalized = {
    language: mapLanguage(analysis.language),
    hinglishStyle: mapHinglishStyle(analysis.hinglishStyle),
    formality: mapFormality(analysis.formality),
    complexity: mapComplexity(analysis.complexity),
    persona: mapPersona(analysis.persona),
    intent: normalizeString(analysis.intent) || 'general',
    preferredResponseStyle: mapResponseStyle(analysis.preferredResponseStyle),
    confidence: Number(analysis.confidence) || 0,
    cleanedMessage: analysis.cleanedMessage || analysis.cleaned_message || '',
  }

  if (!normalized.language || !LANGUAGES.includes(normalized.language)) {
    normalized.language = inferLanguageFromMessage(message)
  }
  if (!normalized.hinglishStyle || !HINGLISH_STYLES.includes(normalized.hinglishStyle)) {
    normalized.hinglishStyle = 'business'
  }
  if (!normalized.formality || !FORMALITY_LEVELS.includes(normalized.formality)) {
    normalized.formality = 'professional'
  }
  if (!normalized.complexity || !COMPLEXITY_LEVELS.includes(normalized.complexity)) {
    normalized.complexity = 'medium'
  }
  if (!normalized.persona || !PERSONAS.includes(normalized.persona)) {
    normalized.persona = 'customer'
  }
  if (!normalized.preferredResponseStyle || !RESPONSE_STYLES.includes(normalized.preferredResponseStyle)) {
    normalized.preferredResponseStyle = 'same_as_user'
  }

  try {
    validateAnalysis(normalized)
  } catch (error) {
    console.error('Language analysis validation failed:', {
      modelOutput: analysis,
      normalized,
    })
    throw error
  }

  const cleanedMessage = normalized.cleanedMessage
    ? cleanHinglishText(normalized.cleanedMessage)
    : cleanHinglishText(message)

  const resolvedSessionId = sessionId || crypto.randomUUID()
  const profile = await upsertProfile(resolvedSessionId, normalized)

  await saveUsageRecord({
    organizationId: 'default',
    sessionId: resolvedSessionId,
    feature: 'language_analysis',
    model,
    inputTokens: usageSummary.inputTokens,
    outputTokens: usageSummary.outputTokens,
    totalTokens: usageSummary.totalTokens,
    estimatedCost: usageSummary.estimatedCost,
    requestType: 'analysis',
  })

  return {
    sessionId: resolvedSessionId,
    language: profile.language,
    hinglishStyle: profile.hinglishStyle,
    formality: profile.formality,
    complexity: profile.complexity,
    persona: profile.persona,
    preferredResponseStyle: profile.preferredResponseStyle,
    intent: normalized.intent,
    confidence: normalized.confidence,
    cleanedMessage,
    usage: {
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
    },
  }
}
