import { useEffect, useRef, useState } from 'react'
import { getRealtimeService } from '../services/webrtc.service'

export function RealtimeVoicePlayer() {
  const audioRef = useRef(null)
  const mediaSourceRef = useRef(null)
  const sourceBufferRef = useRef(null)
  const queueRef = useRef([])
  const fallbackChunksRef = useRef([])
  const fallbackUrlRef = useRef(null)
  const contentTypeRef = useRef('audio/webm; codecs=opus')
  const fallbackModeRef = useRef(false)
  const fallbackStartedRef = useRef(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const realtime = getRealtimeService()

    function resetSource() {
      if (fallbackUrlRef.current) {
        URL.revokeObjectURL(fallbackUrlRef.current)
        fallbackUrlRef.current = null
      }
      fallbackChunksRef.current = []
      fallbackModeRef.current = false
      fallbackStartedRef.current = false
      if (mediaSourceRef.current) {
        mediaSourceRef.current = null
      }
      sourceBufferRef.current = null
      queueRef.current = []
    }

    function normalizeContentType(contentType) {
      if (!contentType) return 'audio/webm; codecs=opus'
      if (contentType.includes('audio/mpeg') && !contentType.includes('codecs')) {
        return 'audio/mpeg; codecs="mp3"'
      }
      return contentType
    }

    function normalizeChunk(chunk) {
      if (!chunk) return null
      if (chunk instanceof ArrayBuffer) {
        return new Uint8Array(chunk)
      }
      if (ArrayBuffer.isView(chunk)) {
        return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength)
      }
      if (chunk?.type === 'Buffer' && Array.isArray(chunk?.data)) {
        return new Uint8Array(chunk.data)
      }
      if (typeof chunk === 'string') {
        try {
          const binary = atob(chunk)
          const bytes = new Uint8Array(binary.length)
          for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i)
          }
          return bytes
        } catch {
          return null
        }
      }
      try {
        return new Uint8Array(chunk)
      } catch {
        return null
      }
    }

    const unsubTtsStart = realtime.on('ttsStart', ({ contentType }) => {
      resetSource()
      const audio = audioRef.current
      if (!audio) return

      const resolvedType = normalizeContentType(contentType)
      contentTypeRef.current = resolvedType
      const canUseMse =
        typeof MediaSource !== 'undefined' &&
        typeof MediaSource.isTypeSupported === 'function' &&
        MediaSource.isTypeSupported(resolvedType)

      if (!canUseMse) {
        fallbackModeRef.current = true
        setIsReady(false)
        return
      }

      const mediaSource = new MediaSource()
      mediaSourceRef.current = mediaSource

      audio.src = URL.createObjectURL(mediaSource)
      audio.load()
      audio.play().catch(() => null)

      mediaSource.addEventListener('sourceopen', () => {
        try {
          const buffer = mediaSource.addSourceBuffer(resolvedType)
          sourceBufferRef.current = buffer
          buffer.addEventListener('updateend', () => {
            if (queueRef.current.length > 0 && !buffer.updating) {
              const next = queueRef.current.shift()
              buffer.appendBuffer(next)
            }
          })
          setIsReady(true)
        } catch {
          setIsReady(false)
        }
      })
    })

    const unsubAudio = realtime.on('audioChunk', (chunk) => {
      const data = normalizeChunk(chunk)
      if (!data) return

      if (fallbackModeRef.current) {
        fallbackChunksRef.current.push(data)
        if (!fallbackStartedRef.current) {
          fallbackStartedRef.current = true
          setIsReady(true)
        }
        return
      }

      if (!sourceBufferRef.current) return
      const buffer = sourceBufferRef.current
      if (!buffer.updating && queueRef.current.length === 0) {
        buffer.appendBuffer(data)
      } else {
        queueRef.current.push(data)
      }
    })

    const unsubTtsEnd = realtime.on('ttsEnd', () => {
      if (fallbackModeRef.current) {
        const audio = audioRef.current
        const chunks = fallbackChunksRef.current
        if (audio && chunks.length) {
          const blob = new Blob(chunks, { type: contentTypeRef.current })
          const url = URL.createObjectURL(blob)
          fallbackUrlRef.current = url
          audio.src = url
          audio.load()
          audio.play().catch(() => null)
          setIsReady(true)
        } else {
          setIsReady(false)
        }
        return
      }
      if (mediaSourceRef.current?.readyState === 'open') {
        try {
          mediaSourceRef.current.endOfStream()
        } catch {
          // ignore
        }
      }
      setIsReady(false)
    })

    const unsubStatus = realtime.on('status', (payload) => {
      if (payload?.state === 'INTERRUPTED') {
        const audio = audioRef.current
        if (audio) {
          audio.pause()
          audio.removeAttribute('src')
          audio.load()
        }
        resetSource()
        setIsReady(false)
      }
    })

    return () => {
      unsubTtsStart()
      unsubAudio()
      unsubTtsEnd()
      unsubStatus()
      resetSource()
    }
  }, [])

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Realtime Voice Output
      </p>
      <p className="mt-1 text-sm text-stone-700">
        {isReady ? 'Streaming...' : 'Waiting for voice stream'}
      </p>
      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}
