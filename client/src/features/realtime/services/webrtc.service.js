import { io } from 'socket.io-client'
import { getApiBaseUrl } from '../../../config/apiBaseUrl'

const STATUS_EVENTS = {
  status: 'status',
  response: 'response',
  metrics: 'metrics',
  ttsStart: 'tts_start',
  ttsEnd: 'tts_end',
  streamEvent: 'stream_event',
  streamSentence: 'stream_sentence',
  streamToken: 'stream_token',
}

const MAX_CONTROL_QUEUE = 50
const MAX_AUDIO_QUEUE = 200
const CONNECT_TIMEOUT_MS = 15000

class RealtimeWebRTCService {
  constructor() {
    this.socket = null
    this.peerConnection = null
    this.controlChannel = null
    this.audioChannel = null
    this.sessionId = null
    this.listeners = new Map()
    this.isConnected = false
    this.controlQueue = []
    this.audioQueue = []
    this.connectionPromise = null
    this.connectionTimeout = null
  }

  clearConnectionTimeout() {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
      this.connectionTimeout = null
    }
  }

  teardownTransport() {
    this.clearConnectionTimeout()

    this.controlChannel?.close?.()
    this.audioChannel?.close?.()
    this.peerConnection?.close?.()

    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.disconnect?.()
    }

    this.socket = null
    this.peerConnection = null
    this.controlChannel = null
    this.audioChannel = null
    this.isConnected = false
  }

  flushControlQueue() {
    if (!this.controlChannel || this.controlChannel.readyState !== 'open') return
    while (this.controlQueue.length) {
      const payload = this.controlQueue.shift()
      try {
        this.controlChannel.send(JSON.stringify(payload))
      } catch {
        break
      }
    }
  }

  flushAudioQueue() {
    if (!this.audioChannel || this.audioChannel.readyState !== 'open') return
    while (this.audioQueue.length) {
      const chunk = this.audioQueue.shift()
      try {
        this.audioChannel.send(chunk)
      } catch {
        break
      }
    }
  }

  on(event, handler) {
    const handlers = this.listeners.get(event) || new Set()
    handlers.add(handler)
    this.listeners.set(event, handlers)

    return () => {
      handlers.delete(handler)
    }
  }

  emit(event, payload) {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach((handler) => handler(payload))
  }

  handleControlPayload(payload) {
    if (!payload?.type) return
    if (payload.type === STATUS_EVENTS.status) {
      this.emit('status', payload)
      return
    }
    if (payload.type === STATUS_EVENTS.response) {
      this.emit('response', payload)
      return
    }
    if (payload.type === STATUS_EVENTS.metrics) {
      this.emit('metrics', payload)
      return
    }
    if (payload.type === STATUS_EVENTS.ttsStart) {
      this.emit('ttsStart', payload)
      return
    }
    if (payload.type === STATUS_EVENTS.ttsEnd) {
      this.emit('ttsEnd', payload)
      return
    }
    if (payload.type === STATUS_EVENTS.streamEvent) {
      this.emit('streamEvent', payload)
      return
    }
    if (payload.type === STATUS_EVENTS.streamSentence) {
      this.emit('streamSentence', payload)
      return
    }
    if (payload.type === STATUS_EVENTS.streamToken) {
      this.emit('streamToken', payload)
    }
  }

  async connect() {
    if (
      this.isConnected &&
      this.socket?.connected &&
      this.sessionId
    ) {
      return this.sessionId
    }

    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.teardownTransport()

    const baseUrl = getApiBaseUrl()
    const configResponse = await fetch(`${baseUrl}/api/v1/realtime/config`)
    if (!configResponse.ok) {
      throw new Error(`Realtime config request failed (${configResponse.status})`)
    }

    const configPayload = await configResponse.json()
    this.sessionId = configPayload?.data?.sessionId || null

    if (!this.sessionId) {
      throw new Error('Realtime session could not be initialized')
    }

    const iceServers = configPayload?.data?.iceServers || []

    this.socket = io(baseUrl, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: false,
    })

    this.peerConnection = new RTCPeerConnection({ iceServers })

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('realtime:ice', {
          sessionId: this.sessionId,
          candidate: event.candidate,
        })
      }
    }

    this.controlChannel = this.peerConnection.createDataChannel('control')
    this.audioChannel = this.peerConnection.createDataChannel('audio')
    this.audioChannel.binaryType = 'arraybuffer'

    let answerReceived = false
    const handshake = { settled: false }

    const maybeResolveConnected = (resolve) => {
      if (handshake.settled) return
      if (!answerReceived) return
      handshake.settled = true
      this.clearConnectionTimeout()
      this.isConnected = true
      this.emit('connection', { status: 'connected' })
      resolve(this.sessionId)
    }

    this.controlChannel.onopen = () => {
      this.flushControlQueue()
    }

    this.audioChannel.onopen = () => {
      this.flushAudioQueue()
    }

    this.controlChannel.onclose = () => {
    }

    this.audioChannel.onclose = () => {
    }

    this.controlChannel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        this.handleControlPayload(payload)
      } catch {
        return
      }
    }

    this.audioChannel.onmessage = (event) => {
      this.emit('audioChunk', event.data)
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const failConnection = (message) => {
        if (handshake.settled) return
        handshake.settled = true
        this.clearConnectionTimeout()
        this.connectionPromise = null
        this.isConnected = false
        this.teardownTransport()
        reject(new Error(message))
      }

      this.connectionTimeout = setTimeout(() => {
        failConnection('Realtime connection timed out')
      }, CONNECT_TIMEOUT_MS)

      this.socket.on('connect', () => {
        this.socket.emit('realtime:join', { sessionId: this.sessionId })
      })

      this.socket.on('connect_error', (error) => {
        failConnection(error?.message || 'Realtime socket connection failed')
      })

      this.socket.on('realtime:ready', async () => {
        try {
          const offer = await this.peerConnection.createOffer()
          await this.peerConnection.setLocalDescription(offer)

          this.socket.emit('realtime:offer', {
            sessionId: this.sessionId,
            offer,
          })
        } catch (error) {
          failConnection(error?.message || 'Failed to create WebRTC offer')
        }
      })

      this.socket.on('realtime:answer', async ({ answer }) => {
        if (!answer) return
        try {
          await this.peerConnection.setRemoteDescription(answer)
          answerReceived = true
          maybeResolveConnected(resolve)
        } catch (error) {
          failConnection(error?.message || 'Failed to apply WebRTC answer')
        }
      })

      this.controlChannel.onopen = () => {
        this.flushControlQueue()
        maybeResolveConnected(resolve)
      }

      this.audioChannel.onopen = () => {
        this.flushAudioQueue()
        maybeResolveConnected(resolve)
      }

      this.socket.connect()
    })

    this.socket.on('realtime:control', (payload) => {
      this.handleControlPayload(payload)
    })

    this.socket.on('realtime:status', (payload) => {
      this.handleControlPayload(payload)
    })

    this.socket.on('realtime:audio', (payload) => {
      const chunk = payload?.chunk ?? payload
      if (chunk) {
        this.emit('audioChunk', chunk)
      }
    })

    this.socket.on('realtime:ice', async ({ candidate }) => {
      if (!candidate) return
      try {
        await this.peerConnection.addIceCandidate(candidate)
      } catch {
        // ignore ice errors
      }
    })

    this.socket.on('realtime:error', (payload) => {
      this.emit('error', payload)
    })

    this.socket.on('disconnect', () => {
      this.clearConnectionTimeout()
      this.connectionPromise = null
      this.isConnected = false
      this.emit('connection', { status: 'disconnected' })
    })

    try {
      return await this.connectionPromise
    } finally {
      this.connectionPromise = null
    }
  }

  sendControl(payload) {
    if (this.controlChannel?.readyState === 'open') {
      try {
        this.controlChannel.send(JSON.stringify(payload))
        return
      } catch {
        // fall through to queue
      }
    }

    if (this.socket?.connected && this.sessionId) {
      this.socket.emit('realtime:control', {
        sessionId: this.sessionId,
        payload,
      })
      return
    }

    if (this.controlQueue.length >= MAX_CONTROL_QUEUE) {
      this.controlQueue.shift()
    }
    this.controlQueue.push(payload)
  }

  sendAudioChunk(chunk) {
    if (this.audioChannel?.readyState === 'open') {
      try {
        this.audioChannel.send(chunk)
        return
      } catch {
        // fall through to queue
      }
    }

    if (this.socket?.connected && this.sessionId) {
      this.socket.emit('realtime:audio', {
        sessionId: this.sessionId,
        chunk,
      })
      return
    }

    if (this.audioQueue.length >= MAX_AUDIO_QUEUE) {
      this.audioQueue.shift()
    }
    this.audioQueue.push(chunk)
  }

  sendBargeIn() {
    this.sendControl({ type: 'barge_in' })
  }

  disconnect() {
    this.connectionPromise = null
    this.teardownTransport()
    this.controlQueue = []
    this.audioQueue = []
    this.emit('connection', { status: 'disconnected' })
  }
}

const realtimeWebRTCService = new RealtimeWebRTCService()

export function getRealtimeService() {
  return realtimeWebRTCService
}
