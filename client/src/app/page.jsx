import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ChatInput } from '../components/ChatInput'
import { ChatWindow } from '../components/ChatWindow'
import { Header } from '../components/Header'
import { LanguageSelector } from '../components/LanguageSelector'
import { VoiceButton } from '../components/VoiceButton'
import { VoicePlayer } from '../components/VoicePlayer'
import { VoiceSelector } from '../components/VoiceSelector'
import { Button } from '../components/ui/button'
import { useChat } from '../hooks/useChat'
import { useVoiceRecorder } from '../hooks/useVoiceRecorder'
import { useTranscribeAudioMutation } from '../features/voice/voiceApi'
import { setVoiceStatus } from '../store/settingsSlice'
import { inferAudioExtension } from '../utils/audio'

export default function Page() {
  const dispatch = useDispatch()
  const voiceStatus = useSelector((state) => state.settings.voiceStatus)
  const { messages, loading, sendMessage, clearChat } = useChat()
  const [inputValue, setInputValue] = useState('')
  const [transcribeAudio] = useTranscribeAudioMutation()

  async function handleTranscription(blob, mimeType) {
    const extension = inferAudioExtension(mimeType)
    const formData = new FormData()
    formData.append('audio', blob, `recording.${extension}`)

    const response = await Promise.race([
      transcribeAudio(formData).unwrap(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('STT timeout')), 35000),
      ),
    ])
    const transcript = response?.data?.transcript || ''

    if (!transcript) {
      throw new Error('Empty transcript')
    }

    setInputValue('')
    await sendMessage(transcript)
  }

  const { toggleRecording } = useVoiceRecorder({
    onTranscription: handleTranscription,
    onStatusChange: (status) => dispatch(setVoiceStatus(status)),
  })

  async function handleSend(message) {
    await sendMessage(message)
    setInputValue('')
  }

  function handleVoiceToggle() {
    toggleRecording(voiceStatus === 'listening')
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
              <VoicePlayer />
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
