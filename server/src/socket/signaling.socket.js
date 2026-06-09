import crypto from 'crypto'
import {
  createRealtimeSession,
  handleOffer,
  handleIceCandidate,
  handleSocketControl,
  handleSocketAudio,
  bindSessionSocket,
  closeSession,
} from '../services/webrtc.service.js'

const sessions = new Map()

const allowedOrigins = new Set(
  String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)

function isAllowedOrigin(origin) {
  if (!origin) return true
  if (allowedOrigins.size === 0) return true
  if (allowedOrigins.has(origin)) return true
  if (origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173') {
    return true
  }

  try {
    const { hostname } = new URL(origin)
    return hostname.endsWith('.vercel.app')
  } catch {
    return false
  }
}

export function registerSignalingServer(io) {
  io.on('connection', (socket) => {
    const origin = socket.handshake.headers.origin
    if (!isAllowedOrigin(origin)) {
      socket.emit('realtime:error', {
        message: 'Origin not allowed',
      })
      socket.disconnect(true)
      return
    }
    socket.on('realtime:join', async (payload = {}) => {
      const sessionId = payload.sessionId || crypto.randomUUID()
      const existing = sessions.get(sessionId)

      if (!existing) {
        const session = await createRealtimeSession({ sessionId, socket })
        sessions.set(sessionId, session)
      } else {
        bindSessionSocket({ sessionId, socket })
      }

      socket.emit('realtime:ready', { sessionId })
    })

    socket.on('realtime:offer', async ({ sessionId, offer }) => {
      try {
        const answer = await handleOffer({ sessionId, offer })
        socket.emit('realtime:answer', { sessionId, answer })
      } catch (error) {
        socket.emit('realtime:error', {
          sessionId,
          message: error?.message || 'Failed to handle offer',
        })
      }
    })

    socket.on('realtime:ice', async ({ sessionId, candidate }) => {
      await handleIceCandidate({ sessionId, candidate })
    })

    socket.on('realtime:control', ({ sessionId, payload }) => {
      handleSocketControl({ sessionId, payload })
    })

    socket.on('realtime:audio', ({ sessionId, chunk }) => {
      handleSocketAudio({ sessionId, chunk })
    })

    socket.on('disconnect', () => {
      for (const [sessionId, session] of sessions.entries()) {
        if (session.socket?.id === socket.id) {
          closeSession(sessionId)
          sessions.delete(sessionId)
        }
      }
    })
  })
}
