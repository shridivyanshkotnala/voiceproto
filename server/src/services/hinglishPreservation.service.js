import OpenAI from 'openai'
import { ApiError } from '../utils/ApiError.js'
import { HINGLISH_PRESERVATION_PROMPT } from '../prompts/hinglishPreservation.prompt.js'
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

// Adapts answer into user's language style (Hinglish/English).
// Input: answer, languageProfile, sessionId
// Output: { adaptedAnswer, usage }
export async function adaptAnswerLanguage({
  answer,
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

  if (!answer || !answer.trim()) {
    throw new ApiError(400, 'Answer is required for language adaptation')
  }

  let response
  try {
    response = await openai.chat.completions.create(
      {
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: HINGLISH_PRESERVATION_PROMPT },
          {
            role: 'user',
            content: `Generated Answer:\n${answer.trim()}\n\nLanguage Profile:\n${JSON.stringify(
              languageProfile || {},
            )}`,
          },
        ],
      },
      {
        timeout: OPENAI_TIMEOUT_MS,
        maxRetries: OPENAI_MAX_RETRIES,
      },
    )
  } catch (error) {
    const message = error?.message || 'Language adaptation request failed.'
    const isTimeout =
      error?.name === 'APIConnectionTimeoutError' || /timed out/i.test(message)

    if (isTimeout) {
      throw new ApiError(
        504,
        `Language adaptation timed out after ${OPENAI_TIMEOUT_MS}ms.`,
      )
    }

    throw new ApiError(502, `Language adaptation failed: ${message}`)
  }

  const usage = response.usage || {}
  const inputTokens = usage.prompt_tokens || 0
  const outputTokens = usage.completion_tokens || 0
  const usageSummary = calculateUsageCost({ model, inputTokens, outputTokens })

  await saveUsageRecord({
    organizationId: 'default',
    sessionId: sessionId || 'anonymous',
    feature: 'hinglish_preservation',
    model,
    inputTokens: usageSummary.inputTokens,
    outputTokens: usageSummary.outputTokens,
    totalTokens: usageSummary.totalTokens,
    estimatedCost: usageSummary.estimatedCost,
    requestType: 'completion',
  })

  const adaptedAnswer = response.choices?.[0]?.message?.content?.trim()

  return {
    adaptedAnswer: adaptedAnswer || answer.trim(),
    usage: {
      model,
      inputTokens: usageSummary.inputTokens,
      outputTokens: usageSummary.outputTokens,
      totalTokens: usageSummary.totalTokens,
      estimatedCost: usageSummary.estimatedCost,
    },
  }
}
