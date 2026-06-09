import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createResponseStreamingService } from '../src/services/responseStreaming.service.js'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('streaming latency keeps first token and first sentence under thresholds', async () => {
  const service = createResponseStreamingService()
  const startedAt = Date.now()
  let firstTokenAt = null
  let firstSentenceAt = null

  async function* tokens() {
    const parts = [
      'Ji ',
      'Sir, ',
      '14k aur 18k calculation supported hai, ',
      'live rate ke basis par pricing hoti hai. ',
      'Aap scanner se turant valuation dekh sakte hain.',
    ]

    for (const part of parts) {
      await wait(60)
      yield part
    }
  }

  const result = await service.consume({
    tokenStream: tokens(),
    onEvent: (event) => {
      if (event.type === 'FIRST_TOKEN' && !firstTokenAt) {
        firstTokenAt = Date.now()
      }
      if (event.type === 'FIRST_SENTENCE' && !firstSentenceAt) {
        firstSentenceAt = Date.now()
      }
    },
  })

  const ttfToken = firstTokenAt - startedAt
  const ttfSentence = firstSentenceAt - startedAt

  assert.ok(result.text.length > 0)
  assert.ok(ttfToken < 700, `Expected first token < 700ms, got ${ttfToken}`)
  assert.ok(ttfSentence < 1200, `Expected first sentence < 1200ms, got ${ttfSentence}`)
})
