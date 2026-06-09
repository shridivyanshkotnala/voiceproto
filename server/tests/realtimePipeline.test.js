import { test } from 'node:test'
import assert from 'node:assert/strict'

const ORDER = [
  'LISTENING',
  'TRANSCRIBING',
  'SEARCHING_KNOWLEDGE',
  'GENERATING_RESPONSE',
  'STREAMING_AUDIO',
  'SPEAKING',
  'COMPLETE',
]

test('realtime pipeline preserves expected state ordering', () => {
  const observed = [
    'LISTENING',
    'TRANSCRIBING',
    'SEARCHING_KNOWLEDGE',
    'GENERATING_RESPONSE',
    'STREAMING_AUDIO',
    'SPEAKING',
    'COMPLETE',
  ]

  assert.deepEqual(observed, ORDER)
})
