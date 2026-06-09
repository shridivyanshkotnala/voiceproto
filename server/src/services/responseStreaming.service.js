import { ApiError } from '../utils/ApiError.js'

export const STREAM_EVENTS = {
  STREAM_STARTED: 'STREAM_STARTED',
  FIRST_TOKEN: 'FIRST_TOKEN',
  FIRST_SENTENCE: 'FIRST_SENTENCE',
  FIRST_AUDIO: 'FIRST_AUDIO',
  STREAM_COMPLETED: 'STREAM_COMPLETED',
  STREAM_CANCELLED: 'STREAM_CANCELLED',
  STREAM_ERROR: 'STREAM_ERROR',
}

const DEFAULT_BOUNDARY_REGEX = /[.!?\n;:]+\s*/g

function nowMs() {
  return Date.now()
}

function abortError(message = 'Streaming cancelled') {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

function safeCallback(fn, payload) {
  if (typeof fn !== 'function') return
  try {
    fn(payload)
  } catch {
    // swallow callback errors to preserve stream flow
  }
}

function createMetrics(startedAt) {
  return {
    startedAt,
    firstTokenAt: null,
    firstSentenceAt: null,
    firstAudioAt: null,
    completedAt: null,
    cancelledAt: null,
    erroredAt: null,
    timeToFirstToken: null,
    timeToFirstSentence: null,
    timeToFirstAudio: null,
    totalGenerationTime: null,
    streamDuration: null,
    tokenCount: 0,
    sentenceCount: 0,
  }
}

function enrichMetrics(metrics) {
  const base = metrics.startedAt || nowMs()

  if (metrics.firstTokenAt && metrics.timeToFirstToken == null) {
    metrics.timeToFirstToken = metrics.firstTokenAt - base
  }

  if (metrics.firstSentenceAt && metrics.timeToFirstSentence == null) {
    metrics.timeToFirstSentence = metrics.firstSentenceAt - base
  }

  if (metrics.firstAudioAt && metrics.timeToFirstAudio == null) {
    metrics.timeToFirstAudio = metrics.firstAudioAt - base
  }

  const end = metrics.completedAt || metrics.cancelledAt || metrics.erroredAt
  if (end && metrics.streamDuration == null) {
    metrics.streamDuration = end - base
  }

  if (metrics.completedAt && metrics.totalGenerationTime == null) {
    metrics.totalGenerationTime = metrics.completedAt - base
  }

  return metrics
}

export class ResponseStreamingService {
  constructor({ sentenceBoundaryRegex = DEFAULT_BOUNDARY_REGEX } = {}) {
    this.sentenceBoundaryRegex = sentenceBoundaryRegex
  }

  extractSentences(buffer = '') {
    const output = []
    let lastIndex = 0
    this.sentenceBoundaryRegex.lastIndex = 0

    let match = this.sentenceBoundaryRegex.exec(buffer)
    while (match) {
      const end = this.sentenceBoundaryRegex.lastIndex
      const sentence = buffer.slice(lastIndex, end).trim()
      if (sentence) {
        output.push(sentence)
      }
      lastIndex = end
      match = this.sentenceBoundaryRegex.exec(buffer)
    }

    return {
      sentences: output,
      remainder: buffer.slice(lastIndex),
    }
  }

  markFirstAudio(metrics) {
    if (!metrics.firstAudioAt) {
      metrics.firstAudioAt = nowMs()
      enrichMetrics(metrics)
      return true
    }
    return false
  }

  async consume({
    tokenStream,
    signal,
    onEvent,
    onToken,
    onSentence,
    onMetrics,
  }) {
    if (!tokenStream || typeof tokenStream[Symbol.asyncIterator] !== 'function') {
      throw new ApiError(500, 'Invalid token stream for response streaming.')
    }

    const startedAt = nowMs()
    const metrics = createMetrics(startedAt)
    let fullText = ''
    let sentenceBuffer = ''

    const emitEvent = (type, data = {}) => {
      safeCallback(onEvent, {
        type,
        at: nowMs(),
        ...data,
      })
    }

    const emitSentence = (sentence) => {
      metrics.sentenceCount += 1
      if (!metrics.firstSentenceAt) {
        metrics.firstSentenceAt = nowMs()
        enrichMetrics(metrics)
        emitEvent(STREAM_EVENTS.FIRST_SENTENCE, {
          sentence,
          metrics: { ...metrics },
        })
      }
      safeCallback(onSentence, sentence)
    }

    emitEvent(STREAM_EVENTS.STREAM_STARTED)

    const handleAbort = () => {
      metrics.cancelledAt = nowMs()
      enrichMetrics(metrics)
      emitEvent(STREAM_EVENTS.STREAM_CANCELLED, {
        metrics: { ...metrics },
      })
      safeCallback(onMetrics, { ...metrics })
    }

    if (signal?.aborted) {
      handleAbort()
      throw abortError()
    }

    try {
      for await (const token of tokenStream) {
        if (signal?.aborted) {
          handleAbort()
          throw abortError()
        }

        const safeToken = String(token || '')
        if (!safeToken) continue

        if (!metrics.firstTokenAt) {
          metrics.firstTokenAt = nowMs()
          enrichMetrics(metrics)
          emitEvent(STREAM_EVENTS.FIRST_TOKEN, {
            token: safeToken,
            metrics: { ...metrics },
          })
        }

        metrics.tokenCount += 1
        safeCallback(onToken, safeToken)

        fullText += safeToken
        sentenceBuffer += safeToken

        const { sentences, remainder } = this.extractSentences(sentenceBuffer)
        for (const sentence of sentences) {
          emitSentence(sentence)
        }
        sentenceBuffer = remainder
      }

      const trailing = sentenceBuffer.trim()
      if (trailing) {
        emitSentence(trailing)
      }

      metrics.completedAt = nowMs()
      enrichMetrics(metrics)
      emitEvent(STREAM_EVENTS.STREAM_COMPLETED, {
        text: fullText,
        metrics: { ...metrics },
      })
      safeCallback(onMetrics, { ...metrics })

      return {
        text: fullText,
        metrics: { ...metrics },
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw error
      }

      metrics.erroredAt = nowMs()
      enrichMetrics(metrics)
      emitEvent(STREAM_EVENTS.STREAM_ERROR, {
        message: error?.message || 'Streaming failed',
        metrics: { ...metrics },
      })
      safeCallback(onMetrics, { ...metrics })
      throw error
    }
  }
}

export function createResponseStreamingService(options = {}) {
  return new ResponseStreamingService(options)
}
