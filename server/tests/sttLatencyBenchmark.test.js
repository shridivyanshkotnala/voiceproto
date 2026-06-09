import { test } from 'node:test'
import assert from 'node:assert/strict'

function sttLatencyBreakdown(metrics) {
  return {
    recordToUpload: metrics.uploadStart - metrics.micStart,
    uploadDuration: metrics.uploadEnd - metrics.uploadStart,
    sttDuration: metrics.sttEnd - metrics.sttStart,
    total: metrics.sttEnd - metrics.micStart,
  }
}

test('stt latency breakdown computes valid stage durations', () => {
  const metrics = {
    micStart: 1000,
    uploadStart: 1800,
    uploadEnd: 2200,
    sttStart: 2200,
    sttEnd: 3200,
  }

  const out = sttLatencyBreakdown(metrics)
  assert.equal(out.recordToUpload, 800)
  assert.equal(out.uploadDuration, 400)
  assert.equal(out.sttDuration, 1000)
  assert.equal(out.total, 2200)
})
