function nowMs() {
  return Date.now()
}

export class SentenceQueueService {
  constructor({ processor, onError, onDrain } = {}) {
    this.processor = processor
    this.onError = onError
    this.onDrain = onDrain
    this.queue = []
    this.processing = false
    this.cancelled = false
    this.currentItem = null
    this.cancelCurrent = null
    this.processedCount = 0
  }

  size() {
    return this.queue.length + (this.processing ? 1 : 0)
  }

  snapshot() {
    return {
      queued: this.queue.length,
      processing: this.processing,
      cancelled: this.cancelled,
      processedCount: this.processedCount,
      currentSentence: this.currentItem?.sentence || null,
    }
  }

  enqueue(sentence, metadata = {}) {
    const trimmed = String(sentence || '').trim()
    if (!trimmed || this.cancelled) {
      return false
    }

    this.queue.push({ sentence: trimmed, metadata, enqueuedAt: nowMs() })
    this.drain().catch((error) => {
      if (typeof this.onError === 'function') {
        this.onError(error)
      }
    })
    return true
  }

  async drain() {
    if (this.processing || this.cancelled) {
      return
    }

    this.processing = true

    try {
      while (!this.cancelled && this.queue.length > 0) {
        const next = this.queue.shift()
        this.currentItem = next

        try {
          const possibleCancel = await this.processor?.(next)
          this.cancelCurrent = typeof possibleCancel === 'function' ? possibleCancel : null
          this.processedCount += 1
        } catch (error) {
          if (typeof this.onError === 'function') {
            this.onError(error, next)
          }
        } finally {
          this.cancelCurrent = null
          this.currentItem = null
        }
      }
    } finally {
      this.processing = false
      if (!this.cancelled && this.queue.length === 0 && typeof this.onDrain === 'function') {
        this.onDrain(this.snapshot())
      }
    }
  }

  clear() {
    this.queue = []
  }

  cancel(reason = 'cancelled') {
    this.cancelled = true
    this.queue = []

    if (typeof this.cancelCurrent === 'function') {
      try {
        this.cancelCurrent(reason)
      } catch {
        // ignore cancel callback failures
      }
    }

    this.currentItem = null
    this.processing = false
    this.cancelCurrent = null
  }

  reset() {
    this.queue = []
    this.processing = false
    this.cancelled = false
    this.currentItem = null
    this.cancelCurrent = null
    this.processedCount = 0
  }
}

export function createSentenceQueueService(options = {}) {
  return new SentenceQueueService(options)
}
