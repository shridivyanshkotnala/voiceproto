import { useState } from 'react'
import { ChatInput } from '../components/ChatInput'
import { ChatWindow } from '../components/ChatWindow'
import { Header } from '../components/Header'
import { LanguageSelector } from '../components/LanguageSelector'
import { VoiceButton } from '../components/VoiceButton'
import { VoiceSelector } from '../components/VoiceSelector'
import { Button } from '../components/ui/button'
import { useChat } from '../hooks/useChat'
import { VoiceStatusIndicator } from '../features/realtime/components/VoiceStatusIndicator'
import { RealtimeVoicePlayer } from '../features/realtime/components/RealtimeVoicePlayer'
import { useRealtimeVoice } from '../features/realtime/hooks/useRealtimeVoice'

export default function Page() {
  const { messages, loading, sendMessage, clearChat } = useChat()
  const [inputValue, setInputValue] = useState('')
  const { currentState, toggleRecording } = useRealtimeVoice()

  const voiceStatus = {
    IDLE: 'idle',
    LISTENING: 'listening',
    PROCESSING: 'processing',
    TRANSCRIBING: 'processing',
    SEARCHING_KNOWLEDGE: 'processing',
    GENERATING_RESPONSE: 'processing',
    SYNTHESIZING: 'processing',
    STREAMING_AUDIO: 'speaking',
    SPEAKING: 'speaking',
    COMPLETE: 'idle',
    INTERRUPTED: 'idle',
    ERROR: 'idle',
  }[currentState]

  async function handleSend(message) {
    await sendMessage(message)
    setInputValue('')
  }

  function handleVoiceToggle() {
    toggleRecording()
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-stone-900">
      <Header />

      <main className="flex flex-1 flex-col">
        <section className="border-b border-stone-200 bg-stone-50 px-4 py-3 sm:px-6">
          <div className="mx-auto grid w-full max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
            <VoiceSelector />
            <LanguageSelector />
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                onClick={clearChat}
                className="w-full lg:w-auto"
              >
                Clear Chat
              </Button>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <VoiceButton status={voiceStatus} onToggleStatus={handleVoiceToggle} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <VoiceStatusIndicator />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <RealtimeVoicePlayer />
            </div>
          </div>
        </section>

        <ChatWindow messages={messages} loading={loading} />
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          loading={loading}
          onVoiceClick={handleVoiceToggle}
        />
      </main>
    </div>
  )
}
