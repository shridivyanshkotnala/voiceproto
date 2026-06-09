import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSentenceQueueService } from '../src/services/sentenceQueue.service.js'

test('sentence queue preserves FIFO ordering', async () => {
  const processed = []
  const queue = createSentenceQueueService({
    processor: async ({ sentence }) => {
      await new Promise((resolve) => setTimeout(resolve, 2))
      processed.push(sentence)
    },
  })

  queue.enqueue('sentence-1')
  queue.enqueue('sentence-2')
  queue.enqueue('sentence-3')

  await new Promise((resolve) => setTimeout(resolve, 40))

  assert.deepEqual(processed, ['sentence-1', 'sentence-2', 'sentence-3'])
  assert.equal(queue.snapshot().queued, 0)
})

test('sentence queue cancel clears pending work', async () => {
  const processed = []
  const queue = createSentenceQueueService({
    processor: async ({ sentence }) => {
      processed.push(sentence)
      await new Promise((resolve) => setTimeout(resolve, 10))
    },
  })

  queue.enqueue('a')
  queue.enqueue('b')
  queue.enqueue('c')

  await new Promise((resolve) => setTimeout(resolve, 1))
  queue.cancel('test_cancel')

  await new Promise((resolve) => setTimeout(resolve, 30))

  assert.ok(processed.length <= 1)
  assert.equal(queue.snapshot().queued, 0)
  assert.equal(queue.snapshot().cancelled, true)
})
