import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { addMessage, clearChat as clearChatAction, setLoading } from '../store/chatSlice'
import { useGenerateResponseMutation } from '../features/response/responseApi'
import { useSynthesizeVoiceMutation } from '../features/voice/voiceApi'
import {
  setAudioError,
  setAudioLoading,
  setAudioPlaying,
  setLastGeneratedAudio,
} from '../features/voice/voiceSlice'
import { setLanguageProfile } from '../features/language/languageSlice'

export function useChat() {
  const dispatch = useDispatch()
  const messages = useSelector((state) => state.chat.messages)
  const loading = useSelector((state) => state.chat.loading)
  const sessionId = useSelector((state) => state.language.sessionId)
  const selectedVoiceProfile = useSelector(
    (state) => state.voice.selectedVoiceProfile,
  )
  const [generateResponse] = useGenerateResponseMutation()
  const [synthesizeVoice] = useSynthesizeVoiceMutation()

  const sendMessage = useCallback(
    async (inputValue) => {
      const message = inputValue.trim()
      if (!message || loading) {
        return
      }

      const cleanedMessage = message

      dispatch(
        addMessage({
          id: crypto.randomUUID(),
          role: 'user',
          content: cleanedMessage,
          timestamp: new Date().toISOString(),
        }),
      )

      dispatch(setLoading(true))

      try {
        const payload = {
          question: cleanedMessage,
          sessionId: sessionId || undefined,
          conversationHistory: [...messages, { role: 'user', content: cleanedMessage }].slice(-5),
        }

        const result = await generateResponse(payload).unwrap()

        const answer = result?.data?.answer || 'I could not generate a response.'
        const responseLanguageProfile = result?.data?.languageProfile || {
          language: result?.data?.language || 'english',
        }
        const ttsOptimizedAnswer = result?.data?.ttsText || answer
        const responseSessionId = result?.data?.sessionId || sessionId

        dispatch(
          setLanguageProfile({
            ...responseLanguageProfile,
            sessionId: responseSessionId,
          }),
        )

        dispatch(
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: answer,
            timestamp: new Date().toISOString(),
          }),
        )

        dispatch(setAudioLoading(true))
        dispatch(setAudioError(null))
        dispatch(setAudioPlaying(false))

        try {
          const audioResult = await synthesizeVoice({
            text: ttsOptimizedAnswer,
            voiceProfile: selectedVoiceProfile,
            sessionId: responseSessionId || sessionId,
          }).unwrap()

          dispatch(
            setLastGeneratedAudio({
              audioUrl: audioResult.audioUrl,
              audioDuration: audioResult.audioDuration,
              voiceProfile: selectedVoiceProfile,
              text: ttsOptimizedAnswer,
              createdAt: new Date().toISOString(),
            }),
          )
        } catch {
          dispatch(setAudioError('Unable to generate voice output.'))
        } finally {
          dispatch(setAudioLoading(false))
        }
      } catch {
        dispatch(
          addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              'I am unable to process this request right now. Please try again in a moment.',
            timestamp: new Date().toISOString(),
          }),
        )
      } finally {
        dispatch(setLoading(false))
      }
    },
    [
      dispatch,
      loading,
      generateResponse,
      sessionId,
      synthesizeVoice,
      selectedVoiceProfile,
      messages,
    ],
  )

  const clearChat = useCallback(() => {
    dispatch(clearChatAction())
  }, [dispatch])

  return {
    messages,
    loading,
    sendMessage,
    clearChat,
  }
}
