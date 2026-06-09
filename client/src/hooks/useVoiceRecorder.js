import { useCallback, useRef } from 'react'

const SILENCE_THRESHOLD = 0.02
const SILENCE_DURATION = 2000
const MIN_RECORDING_MS = 800
const AUDIO_MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
]

function pickSupportedAudioMimeType() {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return ''
  }

  return AUDIO_MIME_CANDIDATES.find((type) =>
    MediaRecorder.isTypeSupported(type),
  )
}

export function useVoiceRecorder({ onTranscription, onStatusChange }) {
  const mediaRecorderRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioContextRef = useRef(null)
  const analyserRef = useRef(null)
  const rafRef = useRef(null)
  const chunksRef = useRef([])
  const silenceStartRef = useRef(null)
  const speechDetectedRef = useRef(false)
  const recordingStartRef = useRef(null)
  const detectSilenceRef = useRef(null)
  const processingTimeoutRef = useRef(null)

  const cleanup = useCallback(() => {
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
      processingTimeoutRef.current = null
    }
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
  }, [])

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const detectSilence = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) {
      return
    }

    const data = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(data)

    let sum = 0
    for (let i = 0; i < data.length; i += 1) {
      const normalized = (data[i] - 128) / 128
      sum += normalized * normalized
    }

    const rms = Math.sqrt(sum / data.length)
    const now = Date.now()

    if (!speechDetectedRef.current && rms >= SILENCE_THRESHOLD) {
      speechDetectedRef.current = true
      silenceStartRef.current = null
    }

    const recordingStart = recordingStartRef.current || now
    const elapsed = now - recordingStart

    if (speechDetectedRef.current && elapsed > MIN_RECORDING_MS && rms < SILENCE_THRESHOLD) {
      if (!silenceStartRef.current) {
        silenceStartRef.current = now
      }

      if (now - silenceStartRef.current > SILENCE_DURATION) {
        stopRecording()
        return
      }
    } else {
      silenceStartRef.current = null
    }

    rafRef.current = requestAnimationFrame(() => detectSilenceRef.current?.())
  }, [stopRecording])

  const startRecording = useCallback(async () => {
    onStatusChange?.('listening')
    chunksRef.current = []
    silenceStartRef.current = null
    speechDetectedRef.current = false
    recordingStartRef.current = Date.now()

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

      const mimeType = pickSupportedAudioMimeType()
      let recorder

      try {
        recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream)
      } catch {
        recorder = new MediaRecorder(stream)
      }
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        onStatusChange?.('processing')
        processingTimeoutRef.current = setTimeout(() => {
          onStatusChange?.('idle')
        }, 40000)
        cleanup()

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })

        if (blob.size === 0) {
          onStatusChange?.('idle')
          return
        }

        try {
          await onTranscription?.(blob, blob.type)
          onStatusChange?.('idle')
        } catch {
          onStatusChange?.('idle')
        } finally {
          if (processingTimeoutRef.current) {
            clearTimeout(processingTimeoutRef.current)
            processingTimeoutRef.current = null
          }
        }
      }

      mediaRecorderRef.current = recorder
      detectSilenceRef.current = detectSilence
      recorder.start()
      rafRef.current = requestAnimationFrame(() => detectSilenceRef.current?.())
    } catch {
      cleanup()
      onStatusChange?.('idle')
    }
  }, [cleanup, detectSilence, onStatusChange, onTranscription])

  const toggleRecording = useCallback(
    (isRecording) => {
      if (isRecording) {
        stopRecording()
      } else {
        startRecording()
      }
    },
    [startRecording, stopRecording],
  )

  return {
    startRecording,
    stopRecording,
    toggleRecording,
  }
}
