import OpenAI from 'openai'
import { ApiError } from '../utils/ApiError.js'

const EMBEDDING_TIMEOUT_MS = Number(process.env.OPENAI_EMBEDDING_TIMEOUT_MS || 20000)
const EMBEDDING_MAX_RETRIES = Number(process.env.OPENAI_EMBEDDING_MAX_RETRIES || 0)
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small'
const LEGACY_VECTOR_DIMENSIONS = 1536

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: EMBEDDING_TIMEOUT_MS,
  maxRetries: EMBEDDING_MAX_RETRIES,
})

function toPositiveInteger(value) {
  const parsedValue = Number(value)
  if (!Number.isFinite(parsedValue)) {
    return null
  }

  const normalizedValue = Math.trunc(parsedValue)
  return normalizedValue > 0 ? normalizedValue : null
}

function getEmbeddingConfig(overrides = {}) {
  const model = overrides.model || process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
  const overrideDimensions = toPositiveInteger(overrides.dimensions)
  if (overrideDimensions) {
    return { model, dimensions: overrideDimensions }
  }

  const configuredDimensions = toPositiveInteger(
    process.env.OPENAI_EMBEDDING_DIMENSIONS,
  )

  if (configuredDimensions) {
    return { model, dimensions: configuredDimensions }
  }

  if (model === 'text-embedding-3-large') {
    return {
      model,
      // Backward-compatible default for existing Atlas indexes created at 1536.
      dimensions: LEGACY_VECTOR_DIMENSIONS,
    }
  }

  return { model, dimensions: null }
}

// Generates an embedding vector for given text.
// Input: text string
// Output: { embedding, usage }
export async function generateEmbedding(text, overrides = {}) {
  const { model, dimensions } = getEmbeddingConfig(overrides)
  if (!text || !text.trim()) {
    throw new ApiError(400, 'Cannot generate embedding for empty chunk.')
  }

  const embeddingPayload = {
    model,
    input: text,
  }

  if (dimensions) {
    embeddingPayload.dimensions = dimensions
  }

  let response
  try {
    response = await openai.embeddings.create(
      embeddingPayload,
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
    dimensions,
  }
}
