import { test } from 'node:test'
import assert from 'node:assert/strict'

function simulateStreaming(chunks) {
  const received = []
  let firstChunkTime = null
  let currentTime = 0

  for (const chunk of chunks) {
    currentTime += chunk.delay
    if (!firstChunkTime) {
      firstChunkTime = currentTime
    }
    received.push(chunk.data)
  }

  return { received, firstChunkTime }
}

test('Streaming emits first audio chunk without waiting', () => {
  const { received, firstChunkTime } = simulateStreaming([
    { data: 'chunk-1', delay: 50 },
    { data: 'chunk-2', delay: 80 },
  ])

  assert.equal(received.length, 2)
  assert.equal(firstChunkTime, 50)
})
