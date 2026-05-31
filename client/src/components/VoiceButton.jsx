import { Loader2, Mic, Volume2 } from 'lucide-react'
import { Button } from './ui/button'
import { cn } from '../lib/utils'

const statusLabel = {
  idle: 'Idle',
  listening: 'Listening',
  processing: 'Processing',
  speaking: 'Speaking',
}

export function VoiceButton({ status, onToggleStatus }) {
  const isListening = status === 'listening'
  const isProcessing = status === 'processing'
  const isSpeaking = status === 'speaking'

  return (
    <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 p-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
          Voice Controls
        </p>
        <p className="mt-1 text-sm text-stone-700">{statusLabel[status]}</p>
      </div>

      <Button
        type="button"
        variant={isListening || isSpeaking ? 'default' : 'outline'}
        size="icon"
        onClick={onToggleStatus}
        className={cn(isListening && 'animate-pulse', isSpeaking && 'speaker-wave')}
        aria-label="Toggle voice state"
      >
        {isProcessing ? (
          <Loader2 className="size-4 animate-spin" />
        ) : isSpeaking ? (
          <Volume2 className="size-4" />
        ) : (
          <Mic className={cn('size-4', status === 'idle' && 'text-stone-500')} />
        )}
      </Button>
    </div>
  )
}
