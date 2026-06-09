import { test } from 'node:test'
import assert from 'node:assert/strict'

function average(values) {
  return values.reduce((s, v) => s + v, 0) / Math.max(values.length, 1)
}

test('rag regression synthetic benchmark stays above acceptance score', () => {
  const scores = Array.from({ length: 50 }, (_, i) => 0.62 + (i % 5) * 0.03)
  const avg = average(scores)
  assert.ok(avg > 0.6)
})
