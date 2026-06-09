import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createResponseStreamingService,
  STREAM_EVENTS,
} from '../src/services/responseStreaming.service.js'

async function* tokenStream(tokens) {
  for (const token of tokens) {
    await new Promise((resolve) => setTimeout(resolve, 1))
    yield token
  }
}

test('response streaming detects sentence boundaries', async () => {
  const service = createResponseStreamingService()
  const events = []
  const sentences = []

  const result = await service.consume({
    tokenStream: tokenStream(['Ji Sir, ', 'gold rate ', 'aaj 72,000 hai. ', 'Premium 2% hai!']),
    onEvent: (event) => events.push(event.type),
    onSentence: (sentence) => sentences.push(sentence),
  })

  assert.ok(events.includes(STREAM_EVENTS.STREAM_STARTED))
  assert.ok(events.includes(STREAM_EVENTS.FIRST_TOKEN))
  assert.ok(events.includes(STREAM_EVENTS.FIRST_SENTENCE))
  assert.ok(events.includes(STREAM_EVENTS.STREAM_COMPLETED))
  assert.equal(sentences.length, 2)
  assert.equal(sentences[0], 'Ji Sir, gold rate aaj 72,000 hai.')
  assert.equal(sentences[1], 'Premium 2% hai!')
  assert.match(result.text, /gold rate/i)
})

test('response streaming supports cancellation', async () => {
  const service = createResponseStreamingService()
  const controller = new AbortController()
  const events = []

  const promise = service.consume({
    tokenStream: tokenStream(['Hello ', 'world', '.']),
    signal: controller.signal,
    onEvent: (event) => {
      events.push(event.type)
      if (event.type === STREAM_EVENTS.FIRST_TOKEN) {
        controller.abort()
      }
    },
  })

  await assert.rejects(promise, /Streaming cancelled/)
  assert.ok(events.includes(STREAM_EVENTS.STREAM_CANCELLED))
})
