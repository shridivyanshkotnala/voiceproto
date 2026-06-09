import { useEffect, useRef, useState } from 'react'
import { getRealtimeService } from '../services/webrtc.service'

function normalizeChunk(chunk) {
  if (!chunk) return null
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk)
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
  }
  try {
    return new Uint8Array(chunk)
  } catch {
    return null
  }
}

function normalizeContentType(contentType) {
  if (!contentType) return 'audio/webm; codecs=opus'
  if (contentType.includes('audio/mpeg') && !contentType.includes('codecs')) {
    return 'audio/mpeg; codecs="mp3"'
  }
  return contentType
}

export function AudioStreamPlayer() {
  const audioRef = useRef(null)
  const mediaSourceRef = useRef(null)
  const sourceBufferRef = useRef(null)
  const queueRef = useRef([])
  const [status, setStatus] = useState('Waiting for stream')

  useEffect(() => {
    const realtime = getRealtimeService()

    const reset = () => {
      const audio = audioRef.current
      if (audio) {
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
      }
      queueRef.current = []
      sourceBufferRef.current = null
      mediaSourceRef.current = null
      setStatus('Waiting for stream')
    }

    const appendNext = () => {
      const sourceBuffer = sourceBufferRef.current
      if (!sourceBuffer || sourceBuffer.updating || queueRef.current.length === 0) return
      const next = queueRef.current.shift()
      sourceBuffer.appendBuffer(next)
    }

    const unsubTtsStart = realtime.on('ttsStart', ({ contentType }) => {
      reset()

      const audio = audioRef.current
      if (!audio) return

      const resolvedType = normalizeContentType(contentType)
      if (
        typeof MediaSource === 'undefined' ||
        typeof MediaSource.isTypeSupported !== 'function' ||
        !MediaSource.isTypeSupported(resolvedType)
      ) {
        setStatus('Unsupported audio stream format')
        return
      }

      const mediaSource = new MediaSource()
      mediaSourceRef.current = mediaSource

      audio.src = URL.createObjectURL(mediaSource)
      audio.load()
      audio.play().catch(() => null)

      mediaSource.addEventListener('sourceopen', () => {
        try {
          const sourceBuffer = mediaSource.addSourceBuffer(resolvedType)
          sourceBufferRef.current = sourceBuffer
          sourceBuffer.addEventListener('updateend', appendNext)
          setStatus('Streaming audio...')
        } catch {
          setStatus('Audio stream init failed')
        }
      })
    })

    const unsubAudio = realtime.on('audioChunk', (chunk) => {
      const data = normalizeChunk(chunk)
      if (!data) return

      const sourceBuffer = sourceBufferRef.current
      if (!sourceBuffer) return

      if (sourceBuffer.updating || queueRef.current.length > 0) {
        queueRef.current.push(data)
      } else {
        sourceBuffer.appendBuffer(data)
      }

      const audio = audioRef.current
      if (audio?.paused) {
        audio.play().catch(() => null)
      }
    })

    const unsubTtsEnd = realtime.on('ttsEnd', () => {
      const mediaSource = mediaSourceRef.current
      if (mediaSource?.readyState === 'open') {
        try {
          mediaSource.endOfStream()
        } catch {
          // no-op
        }
      }
      setStatus('Playback completed')
    })

    const unsubStatus = realtime.on('status', ({ state }) => {
      if (state === 'INTERRUPTED' || state === 'ERROR') {
        reset()
      }
    })

    return () => {
      unsubTtsStart()
      unsubAudio()
      unsubTtsEnd()
      unsubStatus()
      reset()
    }
  }, [])

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Realtime Audio Stream
      </p>
      <p className="mt-1 text-sm text-stone-700">{status}</p>
      <audio ref={audioRef} preload="metadata" autoPlay />
    </div>
  )
}
