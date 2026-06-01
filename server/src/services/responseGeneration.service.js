import OpenAI from 'openai'
import fs from 'fs/promises'
import path from 'path'
import { ApiError } from '../utils/ApiError.js'
import {
  RESPONSE_FALLBACKS,
  RESPONSE_LIMITS,
} from '../constants/response.constants.js'
import { RESPONSE_GENERATION_PROMPT } from '../prompts/responseGeneration.prompt.js'
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

let cachedKnowledgeFaqPairs = null
const HINGLISH_MARKERS = new Set([
  'kya',
  'yeh',
  'aur',
  'ke',
  'bina',
  'par',
  'karega',
  'haan',
  'dono',
  'basis',
])

// Removes chunk headers and trims context for safer prompting.
// Input: raw context string
// Output: cleaned context string
function sanitizeContext(context) {
  return String(context || '')
    .replace(/\[Chunk\s+\d+\]\s*/gi, '')
    .trim()
}

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTokens(value = '') {
  return normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function extractQAPairs(context = '') {
  const qaRegex = /Q:\s*(.+?)\s*A:\s*(.+?)(?=\s*Q:|\n\s*##\s+|$)/gis
  const pairs = []
  let match

  while ((match = qaRegex.exec(context)) !== null) {
    const question = String(match[1] || '').trim()
    const answer = String(match[2] || '').trim()
    if (question && answer) {
      pairs.push({ question, answer })
    }
  }

  return pairs
}

function detectQuestionLanguage(text = '') {
  const tokens = extractTokens(text)
  if (!tokens.length) {
    return 'english'
  }

  let markerCount = 0
  for (const token of tokens) {
    if (HINGLISH_MARKERS.has(token)) {
      markerCount += 1
    }
  }

  return markerCount >= 2 ? 'hinglish' : 'english'
}

function findBestFaqMatch(question, pairs = []) {
  if (!pairs.length) {
    return null
  }

  const queryTokens = extractTokens(question)
  if (!queryTokens.length) {
    return null
  }

  const queryLanguage = detectQuestionLanguage(question)
  const sameLanguagePairs = pairs.filter(
    (pair) => detectQuestionLanguage(pair.question) === queryLanguage,
  )
  const candidatePairs = sameLanguagePairs.length ? sameLanguagePairs : pairs

  let bestMatch = null

  for (const pair of candidatePairs) {
    const pairTokens = new Set(extractTokens(pair.question))
    if (!pairTokens.size) {
      continue
    }

    let overlap = 0
    for (const token of queryTokens) {
      if (pairTokens.has(token)) {
        overlap += 1
      }
    }

    const score = overlap / Math.max(queryTokens.length, pairTokens.size)
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        answer: pair.answer,
        score,
      }
    }
  }

  if (!bestMatch) {
    return null
  }

  return bestMatch.score >= 0.35 ? bestMatch.answer : null
}

function findContextFaqAnswer(question, context) {
  const pairs = extractQAPairs(context)
  return findBestFaqMatch(question, pairs)
}

async function getKnowledgeFaqPairs() {
  if (cachedKnowledgeFaqPairs) {
    return cachedKnowledgeFaqPairs
  }

  try {
    const knowledgeFilePath =
      process.env.KNOWLEDGE_FILE_PATH || path.resolve(process.cwd(), 'knowledge.txt')
    const knowledgeText = await fs.readFile(knowledgeFilePath, 'utf8')
    cachedKnowledgeFaqPairs = extractQAPairs(knowledgeText)
    return cachedKnowledgeFaqPairs
  } catch {
    cachedKnowledgeFaqPairs = []
    return cachedKnowledgeFaqPairs
  }
}

async function findKnowledgeBaseFaqAnswer(question) {
  const pairs = await getKnowledgeFaqPairs()
  return findBestFaqMatch(question, pairs)
}

// Generates a factual business answer from retrieved context.
// Input: question, context, languageProfile, sessionId
// Output: { answer, usage }
export async function generateBusinessAnswer({
  question,
  context,
  languageProfile,
  sessionId,
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new ApiError(500, 'OpenAI API key is not configured.')
  }

  const model = process.env.OPENAI_MODEL
  if (!model) {
    throw new ApiError(500, 'OpenAI model is not configured.')
  }

  if (!question || !question.trim()) {
    throw new ApiError(400, 'Question is required')
  }

  const cleanedContext = sanitizeContext(context)
  if (!cleanedContext) {
    const canonicalFaqAnswer = await findKnowledgeBaseFaqAnswer(question)
    if (canonicalFaqAnswer) {
      await saveUsageRecord({
        organizationId: 'default',
        sessionId: sessionId || 'anonymous',
        feature: 'response_generation',
        model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        requestType: 'completion',
      })

      return {
        answer: canonicalFaqAnswer,
        usage: {
          model,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          estimatedCost: 0,
        },
      }
    }

    await saveUsageRecord({
      organizationId: 'default',
      sessionId: sessionId || 'anonymous',
      feature: 'response_generation',
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      requestType: 'completion',
    })

    return {
      answer: RESPONSE_FALLBACKS.NO_CONTEXT,
      usage: {
        model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    }
  }

  const faqAnswer = findContextFaqAnswer(question, cleanedContext)
  if (faqAnswer) {
    await saveUsageRecord({
      organizationId: 'default',
      sessionId: sessionId || 'anonymous',
      feature: 'response_generation',
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      requestType: 'completion',
    })

    return {
      answer: faqAnswer,
      usage: {
        model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    }
  }

  const canonicalFaqAnswer = await findKnowledgeBaseFaqAnswer(question)
  if (canonicalFaqAnswer) {
    await saveUsageRecord({
      organizationId: 'default',
      sessionId: sessionId || 'anonymous',
      feature: 'response_generation',
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      requestType: 'completion',
    })

    return {
      answer: canonicalFaqAnswer,
      usage: {
        model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
      },
    }
  }

  let response
  try {
    response = await openai.chat.completions.create(
      {
        model,
        temperature: 0.2,
        messages: [
          { role: 'system', content: RESPONSE_GENERATION_PROMPT },
          {
            role: 'user',
            content: `Question:\n${question.trim()}\n\nRetrieved Context:\n${cleanedContext}\n\nLanguage Profile:\n${JSON.stringify(
              languageProfile || {},
            )}\n\nConstraints:\n- Max ${RESPONSE_LIMITS.MAX_WORDS} words.`,
          },
        ],
      },
      {
        timeout: OPENAI_TIMEOUT_MS,
        maxRetries: OPENAI_MAX_RETRIES,
      },
    )
  } catch (error) {
    const message = error?.message || 'Response generation request failed.'
    const isTimeout =
      error?.name === 'APIConnectionTimeoutError' || /timed out/i.test(message)

    if (isTimeout) {
      throw new ApiError(
        504,
        `Response generation timed out after ${OPENAI_TIMEOUT_MS}ms.`,
      )
    }

    throw new ApiError(502, `Response generation failed: ${message}`)
  }

  const usage = response.usage || {}
  const inputTokens = usage.prompt_tokens || 0
  const outputTokens = usage.completion_tokens || 0
  const usageSummary = calculateUsageCost({ model, inputTokens, outputTokens })

  await saveUsageRecord({
    organizationId: 'default',
    sessionId: sessionId || 'anonymous',
    feature: 'response_generation',
    model,
    inputTokens: usageSummary.inputTokens,
    outputTokens: usageSummary.outputTokens,
    totalTokens: usageSummary.totalTokens,
    estimatedCost: usageSummary.estimatedCost,
    requestType: 'completion',
  })

  const answer = response.choices?.[0]?.message?.content?.trim()

  return {
    answer: answer || RESPONSE_FALLBACKS.NO_CONTEXT,
    usage: {
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
    },
  }
}
