import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'stream'
import { createTtsStreamManagerService } from '../src/services/ttsStreamManager.service.js'
import { STREAM_EVENTS } from '../src/services/responseStreaming.service.js'

function createStream(chunks) {
  async function* iterator() {
    for (const chunk of chunks) {
      await new Promise((resolve) => setTimeout(resolve, 1))
      yield Buffer.from(chunk)
    }
  }
  return Readable.from(iterator())
}

test('tts stream manager streams sentence audio in order', async () => {
  const emitted = []
  const eventTypes = []

  const manager = createTtsStreamManagerService({
    sessionId: 'test-session',
    voiceProfile: 'LUXURY_FEMALE',
    synthesizeVoiceFn: async ({ text }) => ({
      stream: createStream([`audio:${text}:1`, `audio:${text}:2`]),
      contentType: 'audio/mpeg',
      audioDuration: null,
    }),
    onAudioChunk: (chunk) => emitted.push(String(chunk)),
    onEvent: (event) => eventTypes.push(event.type),
  })

  manager.enqueueSentence('first sentence.')
  manager.enqueueSentence('second sentence.')

  const metrics = await manager.waitForDrain()

  assert.equal(emitted.length, 4)
  assert.equal(emitted[0], 'audio:first sentence.:1')
  assert.equal(emitted[2], 'audio:second sentence.:1')
  assert.ok(eventTypes.includes(STREAM_EVENTS.FIRST_AUDIO))
  assert.ok(metrics.totalTTSTime >= 0)
})

test('tts stream manager cancel stops processing', async () => {
  const emitted = []

  const manager = createTtsStreamManagerService({
    sessionId: 'test-session',
    synthesizeVoiceFn: async ({ text }) => ({
      stream: createStream([`audio:${text}:1`, `audio:${text}:2`, `audio:${text}:3`]),
      contentType: 'audio/mpeg',
    }),
    onAudioChunk: (chunk) => emitted.push(String(chunk)),
  })

  manager.enqueueSentence('one.')
  manager.enqueueSentence('two.')

  setTimeout(() => manager.cancel('barge-in'), 2)

  const metrics = await manager.waitForDrain()
  assert.ok(emitted.length < 6)
  assert.ok(metrics.streamDuration >= 0 || metrics.streamDuration === null)
})
