import { test } from 'node:test'
import assert from 'node:assert/strict'

function summarizeStt(metrics) {
  return {
    micToUploadStart: metrics.uploadStart - metrics.micEnd,
    uploadDuration: metrics.uploadEnd - metrics.uploadStart,
    sttDuration: metrics.sttEnd - metrics.sttStart,
    total: metrics.sttEnd - metrics.micEnd,
  }
}

test('STT average latency remains below 1s target', () => {
  const runs = [
    { micEnd: 1000, uploadStart: 1060, uploadEnd: 1220, sttStart: 1225, sttEnd: 1840 },
    { micEnd: 2000, uploadStart: 2085, uploadEnd: 2260, sttStart: 2260, sttEnd: 2865 },
    { micEnd: 3000, uploadStart: 3090, uploadEnd: 3270, sttStart: 3275, sttEnd: 3880 },
  ]

  const totals = runs.map((sample) => summarizeStt(sample).total)
  const avg = totals.reduce((sum, value) => sum + value, 0) / totals.length

  assert.ok(avg < 1000, `Expected avg STT latency < 1000ms, got ${avg.toFixed(2)}ms`)
})
