import { test } from 'node:test'
import assert from 'node:assert/strict'
import { postProcessTtsText } from '../src/services/ttsTextPostProcessor.service.js'

test('postProcessTtsText converts carats and numbers', () => {
  const result = postProcessTtsText('14K gold rate is 1250')
  assert.match(result, /fourteen/i)
  assert.match(result, /carat/i)
  assert.match(result, /one thousand two hundred fifty/i)
})

test('postProcessTtsText converts operators', () => {
  const result = postProcessTtsText('Weight x Rate / Purity = Total')
  assert.match(result, /multiply by/i)
  assert.match(result, /divided by/i)
  assert.match(result, /equals/i)
})
