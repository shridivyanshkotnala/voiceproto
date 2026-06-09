import { io } from 'socket.io-client'
import wrtc from 'wrtc'

const BASE_URL = process.env.WEBRTC_QA_BASE_URL || 'http://localhost:8765'
const ITERATIONS = Number(process.env.WEBRTC_SOAK_ITERATIONS || 100)
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
    responseReceived: false,
    ttsStart: false,
    ttsEnd: false,
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

  const connectionReady = new Promise((resolve) => {
    pc.onconnectionstatechange = () => {
      if (['connected', 'completed'].includes(pc.connectionState)) {
        metrics.connected = true
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

  controlChannel.send(
    JSON.stringify({
      type: 'audio_start',
      mimeType: 'audio/webm',
      fileName: 'recording.webm',
      voiceProfile: 'LUXURY_FEMALE',
      micStartTime: Date.now(),
    }),
  )

  for (let i = 0; i < 6; i += 1) {
    audioChannel.send(Buffer.alloc(3200, i))
    await sleep(20)
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
  await sleep(10)

  return metrics
}

async function main() {
  if (global.gc) {
    global.gc()
  }

  const startMem = process.memoryUsage().heapUsed
  let maxMem = startMem
  const errors = {}

  for (let i = 0; i < ITERATIONS; i += 1) {
    const result = await runSession()
    if (result.error) {
      errors[result.error] = (errors[result.error] || 0) + 1
    }
    if (global.gc && i % 25 === 0) {
      global.gc()
    }
    const currentMem = process.memoryUsage().heapUsed
    if (currentMem > maxMem) {
      maxMem = currentMem
    }
  }

  if (global.gc) {
    global.gc()
  }

  const endMem = process.memoryUsage().heapUsed

  const payload = {
    iterations: ITERATIONS,
    heapStartBytes: startMem,
    heapEndBytes: endMem,
    heapMaxBytes: maxMem,
    heapGrowthBytes: endMem - startMem,
    errors,
  }

  console.log(JSON.stringify(payload))
  setImmediate(() => process.exit(0))
}

main().catch((error) => {
  console.error('WebRTC soak worker failed:', error)
  process.exit(1)
})
