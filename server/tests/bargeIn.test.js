import { test } from 'node:test'
import assert from 'node:assert/strict'

function handleBargeIn(session) {
  if (session.currentTtsStream?.destroy) {
    session.currentTtsStream.destroy()
  }
  session.state = 'INTERRUPTED'
}

test('Barge-in stops current stream and sets state', () => {
  let destroyed = false
  const session = {
    currentTtsStream: { destroy: () => (destroyed = true) },
    state: 'SPEAKING',
  }

  handleBargeIn(session)

  assert.equal(destroyed, true)
  assert.equal(session.state, 'INTERRUPTED')
})
