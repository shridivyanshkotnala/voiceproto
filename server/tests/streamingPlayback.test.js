import { test } from 'node:test'
import assert from 'node:assert/strict'

function playbackQueueSimulator(chunks = []) {
  const queue = []
  const appended = []
  let updating = false

  const append = (chunk) => {
    if (updating || queue.length > 0) {
      queue.push(chunk)
      return
    }
    updating = true
    appended.push(chunk)
    updating = false
    if (queue.length > 0) {
      const next = queue.shift()
      append(next)
    }
  }

  for (const chunk of chunks) append(chunk)

  return appended
}

test('streaming playback appends chunks in order', () => {
  const input = ['c1', 'c2', 'c3', 'c4']
  const out = playbackQueueSimulator(input)
  assert.deepEqual(out, input)
})
