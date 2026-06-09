import { test } from 'node:test'
import assert from 'node:assert/strict'

function isPlainSerializable(value) {
  if (value === null) return true
  const t = typeof value
  if (t === 'string' || t === 'number' || t === 'boolean') return true
  if (Array.isArray(value)) return value.every(isPlainSerializable)
  if (t === 'object') {
    if (value instanceof ArrayBuffer) return false
    if (ArrayBuffer.isView(value)) return false
    return Object.values(value).every(isPlainSerializable)
  }
  return false
}

test('voice streaming state shape is serializable', () => {
  const state = {
    isStreaming: true,
    isSpeaking: false,
    currentSentence: 'Ji Sir',
    audioProgress: { totalChunks: 3, lastChunkBytes: 4096 },
    streamMetrics: {
      timeToFirstToken: 900,
      timeToFirstSentence: 1200,
      timeToFirstAudio: 1500,
      totalGenerationTime: 5200,
      totalTTSTime: 1900,
      streamDuration: 5600,
    },
    streamStatus: 'STREAMING_AUDIO',
  }

  assert.equal(isPlainSerializable(state), true)
})
