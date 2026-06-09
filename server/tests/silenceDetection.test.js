import { test } from 'node:test'
import assert from 'node:assert/strict'

function shouldStopForSilence({ rmsValues, threshold, durationMs, frameMs }) {
  let silenceStart = null
  const start = 0

  for (let i = 0; i < rmsValues.length; i += 1) {
    const rms = rmsValues[i]
    const now = start + i * frameMs

    if (rms >= threshold) {
      silenceStart = null
      continue
    }

    if (silenceStart === null) {
      silenceStart = now
    }

    if (now - silenceStart >= durationMs) {
      return true
    }
  }

  return false
}

test('Silence detection triggers after 1s below threshold', () => {
  const rmsValues = Array.from({ length: 11 }, () => 0.001)
  const triggered = shouldStopForSilence({
    rmsValues,
    threshold: 0.02,
    durationMs: 1000,
    frameMs: 100,
  })
  assert.equal(triggered, true)
})

test('Silence detection does not trigger if speech present', () => {
  const rmsValues = [0.03, 0.02, 0.01, 0.03, 0.01, 0.01, 0.01]
  const triggered = shouldStopForSilence({
    rmsValues,
    threshold: 0.02,
    durationMs: 1000,
    frameMs: 150,
  })
  assert.equal(triggered, false)
})
