import { io } from 'socket.io-client'
import wrtc from 'wrtc'

const BASE_URL = process.env.WEBRTC_QA_BASE_URL || 'http://localhost:8765'
const CONCURRENCY = Number(process.env.WEBRTC_LOAD_CONCURRENCY || 25)
const SESSION_TIMEOUT_MS = Number(process.env.WEBRTC_QA_TIMEOUT_MS || 30000)

function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration))
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

async function runSession() {
  const metrics = {
    connected: false,
    connectTimeMs: null,
    responseReceived: false,
    ttsStart: false,
    ttsEnd: false,
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

  const ttsCompleted = await waitFor(() => metrics.ttsEnd, SESSION_TIMEOUT_MS)
  if (!ttsCompleted) {
    metrics.error = 'tts_timeout'
  }

  socket.disconnect()
  controlChannel.close()
  audioChannel.close()
  pc.close()
  await sleep(25)

  return metrics
}

async function main() {
  const rampMs = Number(process.env.WEBRTC_LOAD_RAMP_MS || 10)
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, index) =>
      sleep(index * rampMs).then(() => runSession()),
    ),
  )

  const total = results.length
  const connectionSuccess = results.filter((item) => item.connected).length
  const streamingSuccess = results.filter(
    (item) => item.ttsStart && item.ttsEnd && item.audioChunks > 0,
  ).length
  const responseSuccess = results.filter((item) => item.responseReceived).length

  const connectTimes = results
    .map((item) => item.connectTimeMs)
    .filter((value) => Number.isFinite(value))

  const avgConnectTime = connectTimes.length
    ? Math.round(connectTimes.reduce((sum, v) => sum + v, 0) / connectTimes.length)
    : null

  const errorCounts = results.reduce(
    (acc, item) => {
      if (!item.error) return acc
      acc[item.error] = (acc[item.error] || 0) + 1
      return acc
    },
    {},
  )

  const payload = {
    concurrency: CONCURRENCY,
    totals: {
      sessions: total,
    },
    rates: {
      connectionSuccessRate: total ? (connectionSuccess / total) * 100 : 0,
      streamingSuccessRate: total ? (streamingSuccess / total) * 100 : 0,
      responseSuccessRate: total ? (responseSuccess / total) * 100 : 0,
    },
    timing: {
      avgConnectTimeMs: avgConnectTime,
    },
    errors: errorCounts,
  }

  console.log(JSON.stringify(payload))
  setImmediate(() => process.exit(0))
}

main().catch((error) => {
  console.error('WebRTC load worker failed:', error)
  process.exit(1)
})
