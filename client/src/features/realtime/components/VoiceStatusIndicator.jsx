import { useSelector } from 'react-redux'

const labels = {
  IDLE: 'Idle',
  LISTENING: 'Listening',
  PROCESSING: 'Processing',
  TRANSCRIBING: 'Transcribing',
  SEARCHING_KNOWLEDGE: 'Searching knowledge',
  GENERATING_RESPONSE: 'Generating response',
  SYNTHESIZING: 'Synthesizing',
  STREAMING_AUDIO: 'Streaming audio',
  SPEAKING: 'Speaking',
  COMPLETE: 'Complete',
  INTERRUPTED: 'Interrupted',
  ERROR: 'Error',
}

export function VoiceStatusIndicator() {
  const { currentState, connectionStatus, lastError } = useSelector(
    (state) => state.realtime,
  )

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
        Realtime Status
      </p>
      <p className="mt-1 text-sm text-stone-700">
        {labels[currentState] || currentState}
      </p>
      <p className="mt-1 text-xs text-stone-500">Connection: {connectionStatus}</p>
      {lastError ? <p className="mt-2 text-xs text-red-600">{lastError}</p> : null}
    </div>
  )
}
