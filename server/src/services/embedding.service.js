import OpenAI from 'openai'
import { ApiError } from '../utils/ApiError.js'

const EMBEDDING_TIMEOUT_MS = Number(process.env.OPENAI_EMBEDDING_TIMEOUT_MS || 20000)
const EMBEDDING_MAX_RETRIES = Number(process.env.OPENAI_EMBEDDING_MAX_RETRIES || 0)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: EMBEDDING_TIMEOUT_MS,
  maxRetries: EMBEDDING_MAX_RETRIES,
})

// Generates an embedding vector for given text.
// Input: text string
// Output: { embedding, usage }
export async function generateEmbedding(text) {
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large'
  if (!text || !text.trim()) {
    throw new ApiError(400, 'Cannot generate embedding for empty chunk.')
  }

  let response
  try {
    response = await openai.embeddings.create(
      {
        model,
        input: text,
      },
      {
        timeout: EMBEDDING_TIMEOUT_MS,
        maxRetries: EMBEDDING_MAX_RETRIES,
      },
    )
  } catch (error) {
    const message = error?.message || 'Unknown embedding service error.'
    const isTimeout =
      error?.name === 'APIConnectionTimeoutError' ||
      /timed out/i.test(message)

    if (isTimeout) {
      throw new ApiError(
        504,
        `Embedding request timed out after ${EMBEDDING_TIMEOUT_MS}ms.`,
      )
    }

    throw new ApiError(502, `Embedding generation failed: ${message}`)
  }

  const embedding = response.data?.[0]?.embedding
  if (!embedding) {
    throw new ApiError(502, 'Failed to generate embedding')
  }

  return {
    embedding,
    usage: response.usage || {},
    model,
  }
}
