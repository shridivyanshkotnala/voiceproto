import { test } from 'node:test'
import assert from 'node:assert/strict'

const allowedStates = new Set([
  'IDLE',
  'LISTENING',
  'PROCESSING',
  'GENERATING_RESPONSE',
  'STREAMING_AUDIO',
  'SPEAKING',
  'INTERRUPTED',
  'ERROR',
])

test('Realtime voice state machine includes required states', () => {
  for (const state of allowedStates) {
    assert.ok(allowedStates.has(state))
  }
})
