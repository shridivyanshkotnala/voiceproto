import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { streamElevenLabsTTS } from '../src/services/voiceStreaming.service.js'

process.env.ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'test-key'

function mockFetch(contentType) {
  global.fetch = async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]))
        controller.close()
      },
    })

    return new Response(body, {
      status: 200,
      headers: { 'Content-Type': contentType },
    })
  }
}

test('TTS supports mp3 content type propagation', async () => {
  process.env.ELEVENLABS_TTS_OUTPUT_FORMAT = 'mp3_44100_128'
  mockFetch('audio/mpeg; codecs=mp3')

  const out = await streamElevenLabsTTS({
    text: 'hello',
    voiceId: 'voice-1',
    modelId: 'model-1',
    voiceSettings: {},
  })

  assert.equal(out.contentType, 'audio/mpeg; codecs=mp3')
  assert.ok(out.stream)
})

test('TTS supports webm opus content type propagation', async () => {
  process.env.ELEVENLABS_TTS_OUTPUT_FORMAT = 'webm_44100_128'
  mockFetch('audio/webm; codecs=opus')

  const out = await streamElevenLabsTTS({
    text: 'hello',
    voiceId: 'voice-2',
    modelId: 'model-2',
    voiceSettings: {},
  })

  assert.match(out.contentType, /audio\/webm/i)
  assert.ok(out.stream)
})
