import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STREAM_EVENTS } from '../src/services/responseStreaming.service.js'

function simulateWebrtcAudioStreaming({ sentences = 3, chunksPerSentence = 2 } = {}) {
  const sentChunks = []
  const events = [STREAM_EVENTS.STREAM_STARTED]

  for (let s = 0; s < sentences; s += 1) {
    if (s === 0) {
      events.push(STREAM_EVENTS.FIRST_SENTENCE)
    }

    for (let c = 0; c < chunksPerSentence; c += 1) {
      if (sentChunks.length === 0) {
        events.push(STREAM_EVENTS.FIRST_AUDIO)
      }
      sentChunks.push(`s${s + 1}-c${c + 1}`)
    }
  }

  events.push(STREAM_EVENTS.STREAM_COMPLETED)
  return { sentChunks, events }
}

test('webrtc audio streaming keeps chunk ordering', () => {
  const result = simulateWebrtcAudioStreaming({ sentences: 2, chunksPerSentence: 3 })

  assert.equal(result.sentChunks.length, 6)
  assert.deepEqual(result.sentChunks, ['s1-c1', 's1-c2', 's1-c3', 's2-c1', 's2-c2', 's2-c3'])
  assert.ok(result.events.includes(STREAM_EVENTS.FIRST_AUDIO))
  assert.equal(result.events.at(-1), STREAM_EVENTS.STREAM_COMPLETED)
})
