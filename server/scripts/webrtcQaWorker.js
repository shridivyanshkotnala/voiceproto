import { io } from 'socket.io-client'
import wrtc from 'wrtc'

const BASE_URL = process.env.WEBRTC_QA_BASE_URL || 'http://localhost:8765'
const ITERATIONS = Number(process.env.WEBRTC_QA_ITERATIONS || 30)
const BARGE_IN_ITERATIONS = Number(process.env.WEBRTC_QA_BARGE_IN || 10)
const RECONNECT_ITERATIONS = Number(process.env.WEBRTC_QA_RECONNECT || 10)
const SESSION_TIMEOUT_MS = Number(process.env.WEBRTC_QA_TIMEOUT_MS || 15000)

function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

function percentile(values, pct) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((pct / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

async function waitFor(conditionFn, timeoutMs, pollMs = 50) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await conditionFn()) return true
    await sleep(pollMs)
  }
  return false
}

async function getConfig() {
  const response = await fetch(`${BASE_URL}/api/v1/realtime/config`)
  const payload = await response.json()
  return payload?.data || {}
}

async function runSession({ bargeIn = false } = {}) {
  const metrics = {
    connected: false,
    connectTimeMs: null,
    responseReceived: false,
    ttsStart: false,
    ttsEnd: false,
    interrupted: false,
    audioChunks: 0,
    summary: null,
    error: null,
  }

  const config = await getConfig()
  const sessionId = config.sessionId
  const iceServers = config.iceServers || []

  const socket = io(BASE_URL, {
    transports: ['websocket'],
    forceNew: true,
  })

  const pc = new wrtc.RTCPeerConnection({ iceServers })
  const controlChannel = pc.createDataChannel('control')
  const audioChannel = pc.createDataChannel('audio')
  audioChannel.binaryType = 'arraybuffer'

  const connectStartedAt = Date.now()

  const connectionReady = new Promise((resolve) => {
    pc.onconnectionstatechange = () => {
      if (['connected', 'completed'].includes(pc.connectionState)) {
        metrics.connected = true
        metrics.connectTimeMs = Date.now() - connectStartedAt
        resolve(true)
      }
    }
  })

  controlChannel.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data)
      if (payload.type === 'status') {
        if (payload.state === 'INTERRUPTED') {
          metrics.interrupted = true
        }
        return
      }
      if (payload.type === 'response') {
        metrics.responseReceived = true
        return
      }
      if (payload.type === 'metrics') {
        metrics.summary = payload.metrics
        return
      }
      if (payload.type === 'tts_start') {
        metrics.ttsStart = true
        return
      }
      if (payload.type === 'tts_end') {
        metrics.ttsEnd = true
      }
    } catch {
      // ignore
    }
  }

  audioChannel.onmessage = () => {
    metrics.audioChunks += 1
  }

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('realtime:ice', { sessionId, candidate: event.candidate })
    }
  }

  socket.on('realtime:ice', async ({ candidate }) => {
    if (!candidate) return
    try {
      await pc.addIceCandidate(candidate)
    } catch {
      // ignore
    }
  })

  await new Promise((resolve) => socket.on('connect', resolve))
  socket.emit('realtime:join', { sessionId })

  socket.on('realtime:ready', async () => {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit('realtime:offer', { sessionId, offer })
  })

  socket.on('realtime:answer', async ({ answer }) => {
    if (!answer) return
    await pc.setRemoteDescription(answer)
  })

  const connected = await Promise.race([
    connectionReady,
    sleep(SESSION_TIMEOUT_MS).then(() => false),
  ])

  if (!connected) {
    metrics.error = 'connect_timeout'
    socket.disconnect()
    pc.close()
    return metrics
  }

  await waitFor(() => controlChannel.readyState === 'open', SESSION_TIMEOUT_MS)

  const micStartTime = Date.now()
  controlChannel.send(
    JSON.stringify({
      type: 'audio_start',
      mimeType: 'audio/webm',
      fileName: 'recording.webm',
      voiceProfile: 'LUXURY_FEMALE',
      micStartTime,
    }),
  )

  for (let i = 0; i < 6; i += 1) {
    audioChannel.send(Buffer.alloc(3200, i))
    await sleep(40)
  }

  controlChannel.send(
    JSON.stringify({
      type: 'audio_end',
      audioUploadTime: Date.now(),
      silenceDetectedTime: Date.now(),
    }),
  )

  if (bargeIn) {
    const bargeInReady = await waitFor(
      () => metrics.ttsStart && metrics.audioChunks > 0,
      SESSION_TIMEOUT_MS,
    )
    if (bargeInReady) {
      controlChannel.send(JSON.stringify({ type: 'barge_in' }))
    }
  }

  await waitFor(
    () => metrics.ttsEnd || metrics.interrupted,
    SESSION_TIMEOUT_MS,
  )

  await sleep(200)

  socket.disconnect()
  controlChannel.close()
  audioChannel.close()
  pc.close()
  await sleep(50)

  return metrics
}

async function runReconnectScenario() {
  const first = await runSession()
  const second = await runSession()
  return first.connected && second.connected
}

async function main() {
  const results = []
  const bargeInResults = []
  const reconnectResults = []

  for (let i = 0; i < ITERATIONS; i += 1) {
    results.push(await runSession())
    if (global.gc) {
      global.gc()
    }
    await sleep(50)
  }

  for (let i = 0; i < BARGE_IN_ITERATIONS; i += 1) {
    bargeInResults.push(await runSession({ bargeIn: true }))
    if (global.gc) {
      global.gc()
    }
    await sleep(50)
  }

  for (let i = 0; i < RECONNECT_ITERATIONS; i += 1) {
    reconnectResults.push(await runReconnectScenario())
    if (global.gc) {
      global.gc()
    }
    await sleep(50)
  }

  const totals = {
    sessions: results.length,
    bargeInSessions: bargeInResults.length,
    reconnectSessions: reconnectResults.length,
  }

  const connectionSuccess = results.filter((item) => item.connected).length
  const streamingSuccess = results.filter(
    (item) => item.ttsStart && item.ttsEnd && item.audioChunks > 0,
  ).length
  const autoSubmitSuccess = results.filter(
    (item) => item.responseReceived && item.ttsStart,
  ).length
  const voiceResponseSuccess = results.filter((item) => item.responseReceived).length
  const bargeInSuccess = bargeInResults.filter((item) => item.interrupted).length
  const reconnectSuccess = reconnectResults.filter(Boolean).length

  const connectTimes = results
    .map((item) => item.connectTimeMs)
    .filter((value) => Number.isFinite(value))

  const timeToFirstAudio = results
    .map((item) => item.summary?.timeToFirstAudio)
    .filter((value) => Number.isFinite(value))

  const totalConversation = results
    .map((item) => item.summary?.totalConversationTime)
    .filter((value) => Number.isFinite(value))

  const latencyStats = {
    connectTime: {
      avg: connectTimes.length
        ? Math.round(connectTimes.reduce((sum, v) => sum + v, 0) / connectTimes.length)
        : null,
      p95: percentile(connectTimes, 95),
    },
    timeToFirstAudio: {
      avg: timeToFirstAudio.length
        ? Math.round(timeToFirstAudio.reduce((sum, v) => sum + v, 0) / timeToFirstAudio.length)
        : null,
      p95: percentile(timeToFirstAudio, 95),
    },
    totalConversation: {
      avg: totalConversation.length
        ? Math.round(
            totalConversation.reduce((sum, v) => sum + v, 0) / totalConversation.length,
          )
        : null,
      p95: percentile(totalConversation, 95),
    },
  }

  const rates = {
    webrtcConnectionSuccessRate: results.length
      ? Number(((connectionSuccess / results.length) * 100).toFixed(2))
      : 0,
    streamingPlaybackSuccessRate: results.length
      ? Number(((streamingSuccess / results.length) * 100).toFixed(2))
      : 0,
    autoSubmitSuccessRate: results.length
      ? Number(((autoSubmitSuccess / results.length) * 100).toFixed(2))
      : 0,
    voiceResponseSuccessRate: results.length
      ? Number(((voiceResponseSuccess / results.length) * 100).toFixed(2))
      : 0,
    bargeInSuccessRate: bargeInResults.length
      ? Number(((bargeInSuccess / bargeInResults.length) * 100).toFixed(2))
      : 0,
    reconnectSuccessRate: reconnectResults.length
      ? Number(((reconnectSuccess / reconnectResults.length) * 100).toFixed(2))
      : 0,
  }

  const payload = {
    totals,
    rates,
    latency: latencyStats,
  }

  console.log(JSON.stringify(payload))
  setImmediate(() => process.exit(0))
}

main().catch((error) => {
  console.error('WebRTC QA worker failed:', error)
  process.exit(1)
})
