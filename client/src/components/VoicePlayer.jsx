import { Pause, Play, RotateCcw, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  clearAudio,
  setAudioError,
  setAudioPlaying,
} from '../features/voice/voiceSlice'
import { setVoiceStatus } from '../store/settingsSlice'
import { Button } from './ui/button'

function formatTime(value) {
  if (!Number.isFinite(value)) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function VoicePlayer() {
  const dispatch = useDispatch()
  const audioRef = useRef(null)
  const [progress, setProgress] = useState({ current: 0, duration: 0 })

  const {
    audioLoading,
    audioPlaying,
    audioError,
    lastGeneratedAudio,
  } = useSelector((state) => state.voice)
  const voiceStatus = useSelector((state) => state.settings.voiceStatus)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    function handleTimeUpdate() {
      setProgress({
        current: audio.currentTime || 0,
        duration: audio.duration || 0,
      })
    }

    function handlePlay() {
      dispatch(setAudioPlaying(true))
      dispatch(setVoiceStatus('speaking'))
    }

    function handlePause() {
      dispatch(setAudioPlaying(false))
      if (voiceStatus === 'speaking') {
        dispatch(setVoiceStatus('idle'))
      }
    }

    function handleEnded() {
      dispatch(setAudioPlaying(false))
      if (voiceStatus === 'speaking') {
        dispatch(setVoiceStatus('idle'))
      }
    }

    function handleError() {
      dispatch(setAudioError('Audio playback failed.'))
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [dispatch, voiceStatus])

  useEffect(() => {
    if (!lastGeneratedAudio?.audioUrl) {
      return
    }

    const audio = audioRef.current
    if (audio) {
      audio.src = lastGeneratedAudio.audioUrl
      audio.load()
      setProgress({ current: 0, duration: 0 })
    }

    return () => {
      URL.revokeObjectURL(lastGeneratedAudio.audioUrl)
    }
  }, [lastGeneratedAudio?.audioUrl])

  function handlePlay() {
    const audio = audioRef.current
    if (!audio) return
    audio.play()
  }

  function handlePause() {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
  }

  function handleStop() {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
  }

  function handleReplay() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = 0
    audio.play()
  }

  function handleSeek(event) {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = Number(event.target.value)
  }

  function handleClear() {
    handleStop()
    dispatch(clearAudio())
  }

  const duration = progress.duration || lastGeneratedAudio?.audioDuration || 0

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Voice Output
          </p>
          <p className="mt-1 text-sm text-stone-700">
            {audioLoading
              ? 'Generating audio...'
              : lastGeneratedAudio
              ? 'Ready to play'
              : 'No audio generated yet'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={audioPlaying ? handlePause : handlePlay}
            disabled={!lastGeneratedAudio || audioLoading}
            aria-label={audioPlaying ? 'Pause audio' : 'Play audio'}
          >
            {audioPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleReplay}
            disabled={!lastGeneratedAudio || audioLoading}
            aria-label="Replay audio"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={handleStop}
            disabled={!lastGeneratedAudio || audioLoading}
            aria-label="Stop audio"
          >
            <Square className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={!lastGeneratedAudio || audioLoading}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-stone-500">{formatTime(progress.current)}</span>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={Math.min(progress.current, duration || 0)}
          onChange={handleSeek}
          disabled={!lastGeneratedAudio || audioLoading}
          className="h-2 w-full cursor-pointer accent-stone-900"
        />
        <span className="text-xs text-stone-500">{formatTime(duration)}</span>
      </div>

      {audioError ? (
        <p className="mt-2 text-xs text-red-600">{audioError}</p>
      ) : null}

      <audio ref={audioRef} preload="metadata" />
    </div>
  )
}