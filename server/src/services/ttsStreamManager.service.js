import { synthesizeVoice } from './voice.service.js'
import { createSentenceQueueService } from './sentenceQueue.service.js'
import { STREAM_EVENTS } from './responseStreaming.service.js'

function nowMs() {
  return Date.now()
}

export class TtsStreamManagerService {
  constructor({
    voiceProfile,
    sessionId,
    realtimeMode = false,
    onAudioChunk,
    onEvent,
    onError,
    synthesizeVoiceFn = synthesizeVoice,
  } = {}) {
    this.voiceProfile = voiceProfile
    this.sessionId = sessionId
    this.realtimeMode = realtimeMode
    this.onAudioChunk = onAudioChunk
    this.onEvent = onEvent
    this.onError = onError
    this.synthesizeVoiceFn = synthesizeVoiceFn
    this.activeStream = null
    this.cancelled = false
    this.totalTTSTime = 0
    this.firstAudioAt = null
    this.startedAt = null
    this.completedAt = null

    this.queue = createSentenceQueueService({
      processor: async (item) => {
        await this.processSentence(item)
      },
      onError: (error, item) => {
        if (typeof this.onError === 'function') {
          this.onError(error, item)
        }
      },
    })
  }

  emit(event, payload = {}) {
    if (typeof this.onEvent !== 'function') return
    this.onEvent({
      type: event,
      at: nowMs(),
      ...payload,
    })
  }

  getMetrics() {
    const streamDuration =
      this.startedAt && this.completedAt ? this.completedAt - this.startedAt : null

    return {
      totalTTSTime: this.totalTTSTime,
      firstAudioAt: this.firstAudioAt,
      streamDuration,
      sentenceQueue: this.queue.snapshot(),
    }
  }

  enqueueSentence(sentence, metadata = {}) {
    if (this.cancelled) {
      return false
    }

    if (!this.startedAt) {
      this.startedAt = nowMs()
    }

    return this.queue.enqueue(sentence, metadata)
  }

  async processSentence({ sentence }) {
    if (this.cancelled) return

    const ttsStart = nowMs()
    const ttsResult = await this.synthesizeVoiceFn({
      text: sentence,
      voiceProfile: this.voiceProfile,
      sessionId: this.sessionId,
      realtimeMode: this.realtimeMode,
    })

    this.totalTTSTime += nowMs() - ttsStart

    await new Promise((resolve, reject) => {
      const stream = ttsResult?.stream
      if (!stream) {
        reject(new Error('Missing TTS stream'))
        return
      }

      this.activeStream = stream

      stream.on('data', (chunk) => {
        if (this.cancelled) return

        if (!this.firstAudioAt) {
          this.firstAudioAt = nowMs()
          this.emit(STREAM_EVENTS.FIRST_AUDIO, {
            contentType: ttsResult?.contentType || 'audio/mpeg',
            audioDuration: ttsResult?.audioDuration ?? null,
          })
        }

        if (typeof this.onAudioChunk === 'function') {
          this.onAudioChunk(chunk, {
            contentType: ttsResult?.contentType || 'audio/mpeg',
            sentence,
          })
        }
      })

      stream.on('end', () => {
        this.activeStream = null
        resolve()
      })

      stream.on('error', (error) => {
        this.activeStream = null
        reject(error)
      })
    })
  }

  async waitForDrain() {
    while (!this.cancelled) {
      const snapshot = this.queue.snapshot()
      if (!snapshot.processing && snapshot.queued === 0) {
        this.completedAt = nowMs()
        return this.getMetrics()
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    this.completedAt = nowMs()
    return this.getMetrics()
  }

  cancel(reason = 'cancelled') {
    this.cancelled = true
    this.queue.cancel(reason)

    if (this.activeStream?.destroy) {
      try {
        this.activeStream.destroy()
      } catch {
        // ignore stream close failures
      }
    }

    this.activeStream = null
    this.completedAt = nowMs()
  }
}

export function createTtsStreamManagerService(options = {}) {
  return new TtsStreamManagerService(options)
}
