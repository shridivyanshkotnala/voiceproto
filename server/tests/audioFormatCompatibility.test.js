import { test } from 'node:test'
import assert from 'node:assert/strict'

function normalizeContentType(contentType) {
  if (!contentType) return 'audio/mpeg; codecs="mp3"'
  if (contentType.includes('audio/mpeg') && !contentType.includes('codecs')) {
    return 'audio/mpeg; codecs="mp3"'
  }
  return contentType
}

function normalizeChunk(chunk) {
  if (!chunk) return null
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk)
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
  }
  if (chunk?.type === 'Buffer' && Array.isArray(chunk?.data)) {
    return new Uint8Array(chunk.data)
  }
  return null
}

test('normalizes mpeg content type for MSE', () => {
  assert.equal(normalizeContentType('audio/mpeg'), 'audio/mpeg; codecs="mp3"')
  assert.equal(
    normalizeContentType('audio/mpeg; codecs="mp3"'),
    'audio/mpeg; codecs="mp3"',
  )
})

test('normalizes Buffer-like chunk payloads', () => {
  const data = normalizeChunk({ type: 'Buffer', data: [1, 2, 3, 4] })
  assert.ok(data)
  assert.equal(data.byteLength, 4)
  assert.equal(data[2], 3)
})
