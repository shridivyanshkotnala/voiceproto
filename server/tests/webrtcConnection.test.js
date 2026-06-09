import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getIceConfig } from '../src/services/webrtc.service.js'

test('WebRTC ICE config returns at least one server', () => {
  const config = getIceConfig()
  assert.ok(Array.isArray(config.iceServers))
  assert.ok(config.iceServers.length > 0)
})
