import { useCallback, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  setRealtimeState,
  setRecording,
  setProcessing,
  setSpeaking,
  setConnectionStatus,
  setRealtimeError,
  setRealtimeStatus,
  setRealtimeMetrics,
} from '../store/realtimeSlice'
import {
  incrementAudioProgress,
  setCurrentSentence,
  setSpeaking as setStreamingSpeaking,
  setStreamMetrics,
  setStreamStatus,
  setStreaming,
} from '../store/voiceStreamingSlice'
import { addMessage } from '../../../store/chatSlice'
import { getRealtimeService } from '../services/webrtc.service'

const SILENCE_THRESHOLD = 0.02
const SILENCE_DURATION = 700
const MIN_RECORDING_MS = 400
const MIN_SPEECH_FRAMES = 6

function inferExtension(mimeType) {
  if (mimeType?.includes('webm')) return 'webm'
  if (mimeType?.includes('ogg')) return 'ogg'
  if (mimeType?.includes('mp4')) return 'mp4'
  return 'webm'
}

function normalizeAssistantAnswer(rawAnswer) {
  const answer = String(rawAnswer || '').trim()
  if (!answer) return ''

  const start = answer.indexOf('{')
  const end = answer.lastIndexOf('}')
  if (start === -1 || end <= start) return answer

  try {
    const parsed = JSON.parse(answer.slice(start, end + 1))
    return String(parsed?.displayText || parsed?.answer || answer).trim()
  } catch {
    return answer
  }
}

export function useRealtimeVoice() {
  const dispatch = useDispatch()
  const voiceProfile = useSelector((state) => state.voice.selectedVoiceProfile)
  const currentState = useSelector((state) => state.realtime.currentState)

  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const silenceLoopRef = useRef(null)
  const rafRef = useRef(null)
  const silenceStartRef = useRef(null)
  const speechDetectedRef = useRef(false)
  const speechFramesRef = useRef(0)
  const lastVoiceActivityRef = useRef(null)
  const recordingStartRef = useRef(null)
  const processingWatchdogRef = useRef(null)

  const realtime = getRealtimeService()

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => null)
      audioContextRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (processingWatchdogRef.current) {
      clearTimeout(processingWatchdogRef.current)
      processingWatchdogRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleSilenceDetection = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return

    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)

    let sum = 0
    for (let i = 0; i < data.length; i += 1) {
      const normalized = (data[i] - 128) / 128
      sum += normalized * normalized
    }

    const rms = Math.sqrt(sum / data.length)
    const now = Date.now()

    if (rms >= SILENCE_THRESHOLD) {
      speechFramesRef.current += 1
      lastVoiceActivityRef.current = now
      if (!speechDetectedRef.current && speechFramesRef.current >= MIN_SPEECH_FRAMES) {
        speechDetectedRef.current = true
        silenceStartRef.current = null
      }
    } else {
      speechFramesRef.current = 0
    }

    const recordingStart = recordingStartRef.current || now
    const elapsed = now - recordingStart

    if (speechDetectedRef.current && elapsed > MIN_RECORDING_MS) {
      const lastVoiceAt = lastVoiceActivityRef.current || recordingStart
      if (!silenceStartRef.current) {
        silenceStartRef.current = lastVoiceAt
      }

      if (now - lastVoiceAt > SILENCE_DURATION) {
        stopRecording()
        return
      }
    } else {
      silenceStartRef.current = null
    }

    rafRef.current = requestAnimationFrame(() => {
      silenceLoopRef.current?.()
    })
  }, [stopRecording])

  useEffect(() => {
    silenceLoopRef.current = handleSilenceDetection
  }, [handleSilenceDetection])

  const startRecording = async () => {
    if (!realtime.isConnected) {
      dispatch(setConnectionStatus('connecting'))
      try {
        await realtime.connect()
      } catch (error) {
        dispatch(setConnectionStatus('disconnected'))
        dispatch(setRecording(false))
        dispatch(setProcessing(false))
        dispatch(setSpeaking(false))
        dispatch(setRealtimeState('ERROR'))
        dispatch(
          setRealtimeError(error?.message || 'Failed to connect realtime voice session'),
        )
        return
      }
    }

    if (currentState === 'SPEAKING') {
      realtime.sendBargeIn()
    }

    dispatch(setRealtimeState('LISTENING'))
    dispatch(setRecording(true))
    dispatch(setRealtimeError(null))

    recordingStartRef.current = Date.now()
    speechDetectedRef.current = false
    speechFramesRef.current = 0
    lastVoiceActivityRef.current = null
    silenceStartRef.current = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 2048

      audioContextRef.current = audioContext
      analyserRef.current = analyser

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder

      const mimeType = recorder.mimeType || 'audio/webm'
      const extension = inferExtension(mimeType)

      realtime.sendControl({
        type: 'audio_start',
        mimeType,
        fileName: `recording.${extension}`,
        voiceProfile,
        micStartTime: recordingStartRef.current,
      })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          event.data
            .arrayBuffer()
            .then((buffer) => realtime.sendAudioChunk(buffer))
            .catch(() => null)
        }
      }

      recorder.onstop = () => {
        const recordingDuration = Date.now() - (recordingStartRef.current || Date.now())

        if (!speechDetectedRef.current || recordingDuration < MIN_RECORDING_MS) {
          dispatch(setRecording(false))
          dispatch(setProcessing(false))
          dispatch(setSpeaking(false))
          dispatch(setRealtimeState('IDLE'))
          dispatch(setRealtimeError('No clear speech detected. Please try again.'))
          cleanup()
          return
        }

        dispatch(setRecording(false))
        dispatch(setRealtimeState('PROCESSING'))
        dispatch(setProcessing(true))

        if (processingWatchdogRef.current) {
          clearTimeout(processingWatchdogRef.current)
        }
        processingWatchdogRef.current = setTimeout(() => {
          dispatch(setProcessing(false))
          dispatch(setSpeaking(false))
          dispatch(setRealtimeState('ERROR'))
          dispatch(
            setRealtimeError('Realtime response timed out. Please try speaking again.'),
          )
        }, 20000)

        realtime.sendControl({
          type: 'audio_end',
          audioUploadTime: Date.now(),
          silenceDetectedTime: silenceStartRef.current,
        })
        cleanup()
      }

      recorder.start(120)
      rafRef.current = requestAnimationFrame(() => {
        silenceLoopRef.current?.()
      })
    } catch (error) {
      cleanup()
      dispatch(setRecording(false))
      dispatch(setProcessing(false))
      dispatch(setSpeaking(false))
      dispatch(setRealtimeState('ERROR'))
      dispatch(setRealtimeError(error?.message || 'Microphone permission denied'))
    }
  }

  const toggleRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      stopRecording()
    } else {
      startRecording()
    }
  }

  useEffect(() => {
    const unsubStatus = realtime.on('status', (payload) => {
      if (
        processingWatchdogRef.current &&
        ![
          'PROCESSING',
          'TRANSCRIBING',
          'SEARCHING_KNOWLEDGE',
          'GENERATING_RESPONSE',
          'SYNTHESIZING',
        ].includes(payload.state)
      ) {
        clearTimeout(processingWatchdogRef.current)
        processingWatchdogRef.current = null
      }

      dispatch(setRealtimeState(payload.state))
      dispatch(setRealtimeStatus(payload.state))
      dispatch(setStreamStatus(payload.state))
      dispatch(
        setProcessing(
          [
            'PROCESSING',
            'TRANSCRIBING',
            'SEARCHING_KNOWLEDGE',
            'GENERATING_RESPONSE',
            'SYNTHESIZING',
            'STREAMING_AUDIO',
          ].includes(payload.state),
        ),
      )
      dispatch(setSpeaking(payload.state === 'SPEAKING'))
      dispatch(setStreamingSpeaking(payload.state === 'SPEAKING'))

      if (['IDLE', 'COMPLETE', 'ERROR', 'INTERRUPTED'].includes(payload.state)) {
        dispatch(setStreaming(false))
      }
    })

    const unsubResponse = realtime.on('response', (payload) => {
      const normalizedAnswer =
        normalizeAssistantAnswer(payload?.answer) ||
        'I could not generate a response.'

      dispatch(
        addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: normalizedAnswer,
          timestamp: new Date().toISOString(),
        }),
      )
    })

    const unsubMetrics = realtime.on('metrics', (payload) => {
      dispatch(setRealtimeMetrics(payload.metrics || {}))
      dispatch(
        setStreamMetrics({
          timeToFirstToken: payload?.metrics?.timeToFirstToken ?? null,
          timeToFirstSentence: payload?.metrics?.timeToFirstSentence ?? null,
          timeToFirstAudio: payload?.metrics?.timeToFirstAudio ?? null,
          totalGenerationTime: payload?.metrics?.timeToResponse ?? null,
          totalTTSTime: payload?.metrics?.totalTTSTime ?? null,
          streamDuration: payload?.metrics?.streamDuration ?? null,
        }),
      )
    })

    const unsubStreamEvent = realtime.on('streamEvent', (payload) => {
      const eventType = payload?.eventType || payload?.data?.type
      if (!eventType) return

      dispatch(setStreamStatus(eventType))

      if (eventType === 'STREAM_STARTED') {
        dispatch(setStreaming(true))
      }

      if (eventType === 'FIRST_AUDIO') {
        dispatch(setStreamingSpeaking(true))
      }

      if (['STREAM_COMPLETED', 'STREAM_CANCELLED', 'STREAM_ERROR'].includes(eventType)) {
        dispatch(setStreaming(false))
      }

      if (payload?.data?.metrics) {
        dispatch(setStreamMetrics(payload.data.metrics))
      }
    })

    const unsubStreamSentence = realtime.on('streamSentence', (payload) => {
      dispatch(setCurrentSentence(payload?.sentence || ''))
    })

    const unsubAudioChunk = realtime.on('audioChunk', (chunk) => {
      const bytes =
        chunk instanceof ArrayBuffer
          ? chunk.byteLength
          : ArrayBuffer.isView(chunk)
            ? chunk.byteLength
            : Array.isArray(chunk?.data)
              ? chunk.data.length
              : 0
      dispatch(incrementAudioProgress(bytes))
    })

    const unsubError = realtime.on('error', (payload) => {
      if (processingWatchdogRef.current) {
        clearTimeout(processingWatchdogRef.current)
        processingWatchdogRef.current = null
      }
      dispatch(setRecording(false))
      dispatch(setProcessing(false))
      dispatch(setSpeaking(false))
      dispatch(setRealtimeState('ERROR'))
      dispatch(setRealtimeError(payload?.message || 'Realtime error'))
      dispatch(setStreaming(false))
      dispatch(setStreamingSpeaking(false))
      dispatch(setStreamStatus('STREAM_ERROR'))
    })

    const unsubConnection = realtime.on('connection', (payload) => {
      dispatch(setConnectionStatus(payload.status))
    })

    return () => {
      unsubStatus()
      unsubResponse()
      unsubMetrics()
      unsubStreamEvent()
      unsubStreamSentence()
      unsubAudioChunk()
      unsubError()
      unsubConnection()
    }
  }, [dispatch, realtime])

  return {
    startRecording,
    stopRecording,
    toggleRecording,
    currentState,
  }
}
