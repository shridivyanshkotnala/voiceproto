import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { Readable } from 'stream'
import { ApiError } from '../utils/ApiError.js'
import { transcribeAudio } from './stt.service.js'
import { runRetrieval } from './retrieval.layer.service.js'
import {
  generateStreamingResponse,
  generateUnifiedResponse,
} from './responseOrchestrator.service.js'
import { synthesizeVoice } from './voice.service.js'
import {
  createResponseStreamingService,
  STREAM_EVENTS,
} from './responseStreaming.service.js'
import { createTtsStreamManagerService } from './ttsStreamManager.service.js'

const sessions = new Map()
const DISCONNECTED_GRACE_MS = Number(process.env.WEBRTC_DISCONNECTED_GRACE_MS || 10000)

function parseIceServers(raw = '') {
  if (!raw) {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  }
}

export function getIceConfig() {
  return {
    iceServers: parseIceServers(process.env.WEBRTC_ICE_SERVERS || ''),
  }
}

async function loadWebRtc() {
  try {
    const module = await import('wrtc')
    return module?.default ? module.default : module
  } catch (error) {
    throw new ApiError(
      500,
      'WebRTC is not configured on the server. Ensure the wrtc dependency is installed.',
    )
  }
}

function nowMs() {
  return Date.now()
}

function withTimeout(task, timeoutMs, message = 'Operation timed out') {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return task()
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(message)
      error.name = 'TimeoutError'
      reject(error)
    }, timeoutMs)

    Promise.resolve()
      .then(() => task())
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
  })
}

function extractTextFromStructuredAnswer(text = '') {
  const trimmed = String(text || '').trim()
  if (!trimmed) return ''

  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  if (jsonStart === -1 || jsonEnd <= jsonStart) {
    return trimmed
  }

  try {
    const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1))
    const displayText = String(
      parsed?.displayText || parsed?.answer || parsed?.response || '',
    ).trim()
    if (displayText) return displayText
    return trimmed
  } catch {
    const displayMatch = trimmed.match(/"displayText"\s*:\s*"([\s\S]*?)"\s*,/)
    if (displayMatch?.[1]) {
      return displayMatch[1].replace(/\\n/g, '\n').trim()
    }
    return trimmed
  }
}

async function waitForAudioChunks(session, timeoutMs = 500, pollMs = 25) {
  const startedAt = nowMs()
  while (nowMs() - startedAt < timeoutMs) {
    if (session.audioChunks?.length) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return false
}

function isRealtimeMockEnabled() {
  return process.env.REALTIME_MOCK === 'true' && process.env.NODE_ENV !== 'production'
}

function createMockAudioStream({ chunkCount = 20, chunkSize = 3200, intervalMs = 40 } = {}) {
  async function* generator() {
    for (let i = 0; i < chunkCount; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      yield Buffer.alloc(chunkSize, i % 255)
    }
  }

  return Readable.from(generator())
}

function getConfiguredTtsContentType() {
  const format = String(process.env.ELEVENLABS_TTS_OUTPUT_FORMAT || 'webm_44100_128').toLowerCase()
  if (format.startsWith('webm')) return 'audio/webm; codecs=opus'
  if (format.startsWith('pcm') || format.startsWith('wav')) return 'audio/wav'
  return 'audio/mpeg; codecs=mp3'
}

function initMetrics() {
  return {
    micStartTime: null,
    micEndTime: null,
    uploadStartTime: null,
    uploadEndTime: null,
    silenceDetectedTime: null,
    audioUploadTime: null,
    sttTime: null,
    retrievalTime: null,
    generationTime: null,
    ttsTime: null,
    firstAudioTime: null,
    fullPlaybackTime: null,
    firstTokenTime: null,
    firstSentenceTime: null,
    streamStartedTime: null,
    streamCompletedTime: null,
    streamDuration: null,
    totalTTSTime: null,
    sttStartTime: null,
    sttEndTime: null,
    fileWriteStartTime: null,
    fileWriteEndTime: null,
  }
}

function summarizeMetrics(metrics) {
  const timeToTranscript =
    metrics.sttTime && metrics.micStartTime
      ? metrics.sttTime - metrics.micStartTime
      : null
  const timeToResponse =
    metrics.generationTime && metrics.micStartTime
      ? metrics.generationTime - metrics.micStartTime
      : null
  const timeToFirstAudio =
    metrics.firstAudioTime && metrics.micStartTime
      ? metrics.firstAudioTime - metrics.micStartTime
      : null
  const timeToFirstToken =
    metrics.firstTokenTime && metrics.micStartTime
      ? metrics.firstTokenTime - metrics.micStartTime
      : null
  const timeToFirstSentence =
    metrics.firstSentenceTime && metrics.micStartTime
      ? metrics.firstSentenceTime - metrics.micStartTime
      : null
  const totalConversationTime =
    metrics.fullPlaybackTime && metrics.micStartTime
      ? metrics.fullPlaybackTime - metrics.micStartTime
      : null
  const fileWriteLatency =
    metrics.fileWriteStartTime && metrics.fileWriteEndTime
      ? metrics.fileWriteEndTime - metrics.fileWriteStartTime
      : null
  const sttProcessingLatency =
    metrics.sttStartTime && metrics.sttEndTime
      ? metrics.sttEndTime - metrics.sttStartTime
      : null
  const uploadDuration =
    metrics.uploadStartTime && metrics.uploadEndTime
      ? metrics.uploadEndTime - metrics.uploadStartTime
      : null
  const micToUploadStart =
    metrics.micStartTime && metrics.uploadStartTime
      ? metrics.uploadStartTime - metrics.micStartTime
      : null

  return {
    timeToTranscript,
    timeToResponse,
    timeToFirstToken,
    timeToFirstSentence,
    timeToFirstAudio,
    totalConversationTime,
    fileWriteLatency,
    sttProcessingLatency,
    uploadDuration,
    micToUploadStart,
    streamDuration:
      metrics.streamCompletedTime && metrics.streamStartedTime
        ? metrics.streamCompletedTime - metrics.streamStartedTime
        : metrics.streamDuration,
  }
}

function sendControl(session, payload) {
  const message = JSON.stringify(payload)
  let sent = false
  if (session.controlChannel?.readyState === 'open') {
    try {
      session.controlChannel.send(message)
      sent = true
    } catch {
      // fallback to socket emit
    }
  }
  if (!sent) {
    session.socket?.emit('realtime:control', payload)
    if (payload?.type === 'status') {
      session.socket?.emit('realtime:status', payload)
    }
  }
}

function sendStreamEvent(session, eventType, data = {}) {
  sendControl(session, {
    type: 'stream_event',
    eventType,
    data,
    timestamp: nowMs(),
  })
}

function setState(session, state, extra = {}) {
  session.state = state
  sendControl(session, { type: 'status', state, ...extra })
}

async function handleAudioProcessing(session) {
  const startedAt = nowMs()
  const { audioChunks, mimeType, fileName, sessionId, voiceProfile } = session

  if (!audioChunks.length) {
    const received = await waitForAudioChunks(session)
    if (!received || !session.audioChunks.length) {
      setState(session, 'ERROR', { reason: 'empty_audio' })
      return
    }
  }

  if (isRealtimeMockEnabled()) {
    try {
      setState(session, 'TRANSCRIBING')
      session.metrics.sttTime = nowMs()
      const transcript = 'test transcript'

      setState(session, 'SEARCHING_KNOWLEDGE')
      session.metrics.retrievalTime = nowMs()

      setState(session, 'GENERATING_RESPONSE')
      const unified = await generateUnifiedResponse({
        userMessage: transcript,
        conversationHistory: session.conversationHistory || [],
        retrievedContext: '',
        sessionLanguageProfile: { language: 'english' },
        retrievalMetadata: {
          totalMatches: 0,
          averageScore: 0,
        },
        sessionId,
        latencyMetrics: {
          retrievalLatency: 0,
          generationLatency: 0,
        },
      })
      session.metrics.generationTime = nowMs()

      sendControl(session, {
        type: 'response',
        answer: unified.displayText,
        ttsText: unified.ttsText,
        languageProfile: unified.languageProfile,
        sessionId,
      })

      setState(session, 'SYNTHESIZING')
      session.metrics.ttsTime = nowMs()

      const stream = createMockAudioStream()
      const contentType = getConfiguredTtsContentType()
      const audioDuration = null

      sendControl(session, {
        type: 'tts_start',
        contentType,
        audioDuration,
      })

      setState(session, 'STREAMING_AUDIO')

      session.currentTtsStream = stream
      let firstChunk = true

      stream.on('data', (chunk) => {
        if (session.audioChannel?.readyState === 'open') {
          session.audioChannel.send(chunk)
        } else if (session.socket?.connected) {
          session.socket.emit('realtime:audio', {
            sessionId,
            chunk,
          })
        }

        if (firstChunk) {
          firstChunk = false
          session.metrics.firstAudioTime = nowMs()
          setState(session, 'SPEAKING')
        }
      })

      stream.on('end', () => {
        session.metrics.fullPlaybackTime = nowMs()
        sendControl(session, { type: 'tts_end' })
        setState(session, 'COMPLETE')
        sendControl(session, {
          type: 'metrics',
          metrics: {
            ...session.metrics,
            ...summarizeMetrics(session.metrics),
          },
        })
      })

      stream.on('error', () => {
        setState(session, 'ERROR', { reason: 'tts_stream_failed' })
      })

      console.info('[realtime]', {
        sessionId,
        transcriptLength: transcript.length,
        sttLatency: 0,
        retrievalLatency: 0,
        generationLatency: 0,
        ttsLatency: 0,
        totalPipelineLatency: nowMs() - startedAt,
        mock: true,
      })
    } catch (error) {
      console.error('[realtime] pipeline failed', error)
      setState(session, 'ERROR', { reason: error?.message || 'pipeline_failed' })
    } finally {
      session.audioChunks = []
    }
    return
  }

  const tempFile = path.join(
    os.tmpdir(),
    `${sessionId}-${crypto.randomUUID()}-${fileName || 'recording.webm'}`,
  )

  try {
    session.metrics.fileWriteStartTime = nowMs()
    await fs.writeFile(tempFile, Buffer.concat(audioChunks))
    session.metrics.fileWriteEndTime = nowMs()

    setState(session, 'TRANSCRIBING')
    const sttStart = nowMs()
    session.metrics.sttStartTime = sttStart
    const transcript = await transcribeAudio(
      tempFile,
      mimeType || 'audio/webm',
      fileName || 'recording.webm',
    )
    session.metrics.sttTime = nowMs()
    session.metrics.sttEndTime = session.metrics.sttTime

    setState(session, 'SEARCHING_KNOWLEDGE')
    const retrievalStart = nowMs()
    const retrievalTimeoutMs = Number(
      process.env.REALTIME_RETRIEVAL_TIMEOUT_MS || 4000,
    )
    let retrievalResult
    let retrievalTimedOut = false

    try {
      retrievalResult = await withTimeout(
        () =>
          runRetrieval({
            query: transcript,
            sessionId,
            conversationHistory: session.conversationHistory || [],
            realtimeMode: true,
          }),
        retrievalTimeoutMs,
        `Realtime retrieval timed out after ${retrievalTimeoutMs}ms`,
      )
    } catch (error) {
      if (error?.name !== 'TimeoutError') {
        throw error
      }

      retrievalTimedOut = true
      retrievalResult = {
        context: null,
        languageProfile: null,
        retrieval: {
          totalMatches: 0,
          averageScore: 0,
        },
      }

      sendStreamEvent(session, STREAM_EVENTS.STREAM_ERROR, {
        stage: 'retrieval',
        message: error.message,
      })
    }
    session.metrics.retrievalTime = nowMs()

    setState(session, 'GENERATING_RESPONSE')
    const generationStart = nowMs()

    const streamAbortController = new AbortController()
    session.activeAbortController = streamAbortController
    session.metrics.streamStartedTime = nowMs()
    sendStreamEvent(session, STREAM_EVENTS.STREAM_STARTED)

    const streamResponse = await generateStreamingResponse({
      userMessage: transcript,
      conversationHistory: session.conversationHistory || [],
      retrievedContext: retrievalResult.context,
      sessionLanguageProfile: retrievalResult.languageProfile,
      retrievalMetadata: {
        totalMatches: retrievalResult?.retrieval?.totalMatches || 0,
        averageScore: retrievalResult?.retrieval?.averageScore || 0,
      },
      sessionId,
      signal: streamAbortController.signal,
    })

    let aggregatedText = ''
    let ttsStarted = false
    let ttsStartSent = false
    let ttsContentType = getConfiguredTtsContentType()

    const ttsManager = createTtsStreamManagerService({
      voiceProfile: voiceProfile || 'LUXURY_FEMALE',
      sessionId,
      onAudioChunk: (chunk, metadata = {}) => {
        if (!ttsStartSent) {
          ttsStartSent = true
          ttsContentType = metadata?.contentType || ttsContentType
          sendControl(session, {
            type: 'tts_start',
            contentType: ttsContentType,
            audioDuration: null,
          })
        }

        if (session.audioChannel?.readyState === 'open') {
          session.audioChannel.send(chunk)
        } else if (session.socket?.connected) {
          session.socket.emit('realtime:audio', {
            sessionId,
            chunk,
          })
        }

        if (!session.metrics.firstAudioTime) {
          session.metrics.firstAudioTime = nowMs()
          setState(session, 'SPEAKING')
        }
      },
      onEvent: (eventPayload) => {
        sendStreamEvent(session, eventPayload.type, eventPayload)
      },
      onError: (error) => {
        sendStreamEvent(session, STREAM_EVENTS.STREAM_ERROR, {
          stage: 'tts',
          message: error?.message || 'TTS stream failed',
        })
      },
    })
    session.activeTtsManager = ttsManager

    const responseStreamer = createResponseStreamingService()

    const streamingResult = await responseStreamer.consume({
      tokenStream: streamResponse.stream,
      signal: streamAbortController.signal,
      onEvent: (eventPayload) => {
        if (eventPayload.type === STREAM_EVENTS.FIRST_TOKEN) {
          session.metrics.firstTokenTime = nowMs()
        }
        if (eventPayload.type === STREAM_EVENTS.FIRST_SENTENCE) {
          session.metrics.firstSentenceTime = nowMs()
        }
        sendStreamEvent(session, eventPayload.type, eventPayload)
      },
      onToken: (token) => {
        aggregatedText += token
        sendControl(session, { type: 'stream_token', token })
      },
      onSentence: (sentence) => {
        if (!ttsStarted) {
          ttsStarted = true
          session.metrics.ttsTime = nowMs()
          setState(session, 'STREAMING_AUDIO')
        }

        sendControl(session, {
          type: 'stream_sentence',
          sentence,
        })

        ttsManager.enqueueSentence(sentence)
      },
    })

    session.metrics.generationTime = nowMs()
    session.metrics.streamCompletedTime = nowMs()

    const ttsMetrics = await ttsManager.waitForDrain()
    session.metrics.totalTTSTime = ttsMetrics.totalTTSTime
    session.metrics.streamDuration =
      Number(streamingResult?.metrics?.streamDuration || 0) || null

    const structuredAnswer = extractTextFromStructuredAnswer(
      aggregatedText.trim() || streamingResult.text,
    )

    sendControl(session, {
      type: 'response',
      answer: structuredAnswer,
      ttsText: structuredAnswer,
      languageProfile: streamResponse.languageProfile,
      sessionId,
    })

    session.metrics.fullPlaybackTime = nowMs()
    sendControl(session, { type: 'tts_end' })
    sendStreamEvent(session, STREAM_EVENTS.STREAM_COMPLETED, {
      metrics: streamingResult.metrics,
    })
    setState(session, 'COMPLETE')
    sendControl(session, {
      type: 'metrics',
      metrics: {
        ...session.metrics,
        ...summarizeMetrics(session.metrics),
      },
    })

    console.info('[realtime]', {
      sessionId,
      transcriptLength: transcript.length,
      sttLatency: session.metrics.sttTime - sttStart,
      retrievalLatency: session.metrics.retrievalTime - retrievalStart,
      generationLatency: session.metrics.generationTime - generationStart,
      ttsLatency: session.metrics.totalTTSTime,
      streamDuration: session.metrics.streamDuration,
      totalPipelineLatency: nowMs() - startedAt,
      retrievalTimedOut,
    })
  } catch (error) {
    console.error('[realtime] pipeline failed', error)
    if (error?.name === 'AbortError') {
      sendStreamEvent(session, STREAM_EVENTS.STREAM_CANCELLED)
      setState(session, 'INTERRUPTED')
    } else {
      sendStreamEvent(session, STREAM_EVENTS.STREAM_ERROR, {
        message: error?.message || 'pipeline_failed',
      })
      setState(session, 'ERROR', { reason: error?.message || 'pipeline_failed' })
    }
  } finally {
    await fs.unlink(tempFile).catch(() => null)
    session.audioChunks = []
    session.activeAbortController = null
    session.activeTtsManager = null
  }
}

function handleControlMessage(session, payload) {
  if (!payload?.type) return

  switch (payload.type) {
    case 'audio_start':
      session.audioChunks = []
      session.mimeType = payload.mimeType
      session.fileName = payload.fileName
      session.voiceProfile = payload.voiceProfile
      session.metrics.micStartTime = payload.micStartTime || nowMs()
      session.metrics.uploadStartTime = payload.uploadStart || nowMs()
      session.metrics.silenceDetectedTime = payload.silenceDetectedTime || null
      session.metrics.audioUploadTime = payload.audioUploadTime || nowMs()
      setState(session, 'LISTENING')
      break
    case 'audio_end':
      session.metrics.micEndTime = payload.micEnd || nowMs()
      session.metrics.uploadEndTime = payload.uploadEnd || nowMs()
      setState(session, 'PROCESSING')
      handleAudioProcessing(session)
      break
    case 'barge_in':
      session.activeAbortController?.abort?.()
      if (session.activeTtsManager?.cancel) {
        session.activeTtsManager.cancel('barge_in')
      }
      if (session.currentTtsStream?.destroy) {
        session.currentTtsStream.destroy()
      }
      sendControl(session, { type: 'tts_end' })
      sendStreamEvent(session, STREAM_EVENTS.STREAM_CANCELLED)
      setState(session, 'INTERRUPTED')
      break
    case 'client_metrics':
      session.metrics = {
        ...session.metrics,
        ...payload.metrics,
      }
      break
    default:
      break
  }
}

export async function createRealtimeSession({ sessionId, socket }) {
  const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } =
    await loadWebRtc()

  const rtcConfig = getIceConfig()
  const peerConnection = new RTCPeerConnection(rtcConfig)

  const session = {
    sessionId,
    socket,
    peerConnection,
    controlChannel: null,
    audioChannel: null,
    audioChunks: [],
    mimeType: null,
    fileName: null,
    voiceProfile: null,
    state: 'IDLE',
    currentTtsStream: null,
    activeAbortController: null,
    activeTtsManager: null,
    disconnectTimer: null,
    metrics: initMetrics(),
    RTCSessionDescription,
    RTCIceCandidate,
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      session.socket?.emit('realtime:ice', {
        sessionId,
        candidate: event.candidate,
      })
    }
  }

  peerConnection.ondatachannel = (event) => {
    const channel = event.channel
    if (channel.label === 'control') {
      session.controlChannel = channel
      channel.onmessage = (message) => {
        try {
          const payload = JSON.parse(message.data)
          handleControlMessage(session, payload)
        } catch {
          return
        }
      }
    }

    if (channel.label === 'audio') {
      session.audioChannel = channel
      channel.binaryType = 'arraybuffer'
      channel.onmessage = (eventPayload) => {
        if (!session.metrics.uploadStartTime) {
          session.metrics.uploadStartTime = nowMs()
        }
        const chunk = Buffer.from(eventPayload.data)
        session.audioChunks.push(chunk)
        session.metrics.uploadEndTime = nowMs()
      }
    }
  }

  peerConnection.onconnectionstatechange = () => {
    const state = peerConnection.connectionState

    if (state === 'connected' && session.disconnectTimer) {
      clearTimeout(session.disconnectTimer)
      session.disconnectTimer = null
      return
    }

    if (state === 'disconnected') {
      if (session.disconnectTimer) {
        clearTimeout(session.disconnectTimer)
      }

      session.disconnectTimer = setTimeout(() => {
        const latestState = session.peerConnection?.connectionState
        if (latestState === 'disconnected') {
          setState(session, 'ERROR', { reason: 'webrtc_disconnected' })
          closeSession(sessionId)
        }
      }, DISCONNECTED_GRACE_MS)
      return
    }

    if (['failed', 'closed'].includes(state)) {
      setState(session, 'ERROR', { reason: 'webrtc_disconnected' })
      closeSession(sessionId)
    }
  }

  sessions.set(sessionId, session)
  return session
}

export async function handleOffer({ sessionId, offer }) {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new ApiError(404, 'Realtime session not found')
  }

  await session.peerConnection.setRemoteDescription(
    new session.RTCSessionDescription(offer),
  )

  const answer = await session.peerConnection.createAnswer()
  await session.peerConnection.setLocalDescription(answer)

  return answer
}

export async function handleIceCandidate({ sessionId, candidate }) {
  const session = sessions.get(sessionId)
  if (!session || !candidate) return

  try {
    await session.peerConnection.addIceCandidate(
      new session.RTCIceCandidate(candidate),
    )
  } catch {
    // ignore ICE errors
  }
}

export function bindSessionSocket({ sessionId, socket }) {
  const session = sessions.get(sessionId)
  if (!session || !socket) return false
  session.socket = socket
  return true
}

export function handleSocketControl({ sessionId, payload }) {
  const session = sessions.get(sessionId)
  if (!session || !payload) return false

  handleControlMessage(session, payload)
  return true
}

export function handleSocketAudio({ sessionId, chunk }) {
  const session = sessions.get(sessionId)
  if (!session || !chunk) return false

  try {
    if (!session.metrics.uploadStartTime) {
      session.metrics.uploadStartTime = nowMs()
    }
    session.audioChunks.push(Buffer.from(chunk))
    session.metrics.uploadEndTime = nowMs()
    return true
  } catch {
    return false
  }
}

export function closeSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return

  if (session.disconnectTimer) {
    clearTimeout(session.disconnectTimer)
    session.disconnectTimer = null
  }

  try {
    session.peerConnection?.close()
  } catch {
    // noop
  }

  if (session.currentTtsStream?.destroy) {
    session.currentTtsStream.destroy()
  }

  sessions.delete(sessionId)
}
