import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { addMessage, clearChat as clearChatAction, setLoading } from '../store/chatSlice'
import { useLanguageProfile } from '../features/language/useLanguageProfile'
import { useGenerateResponseMutation } from '../features/response/responseApi'
import { useSynthesizeVoiceMutation } from '../features/voice/voiceApi'
import { useOptimizePronunciationMutation } from '../features/pronunciation/pronunciationApi'
import {
  setAudioError,
  setAudioLoading,
  setAudioPlaying,
  setLastGeneratedAudio,
} from '../features/voice/voiceSlice'

export function useChat() {
  const dispatch = useDispatch()
  const messages = useSelector((state) => state.chat.messages)
  const loading = useSelector((state) => state.chat.loading)
  const sessionId = useSelector((state) => state.language.sessionId)
  const selectedVoiceProfile = useSelector(
    (state) => state.voice.selectedVoiceProfile,
  )
  const { analyze } = useLanguageProfile()
  const [generateResponse] = useGenerateResponseMutation()
  const [synthesizeVoice] = useSynthesizeVoiceMutation()
  const [optimizePronunciation] = useOptimizePronunciationMutation()

  const sendMessage = useCallback(
    async (inputValue) => {
      const message = inputValue.trim()
      if (!message || loading) {
        return
      }

      const analysis = await analyze(message)
      const cleanedMessage = analysis?.cleanedMessage || message

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
          sessionId: analysis?.sessionId || sessionId,
        }

        const result = await generateResponse(payload).unwrap()

        const answer = result?.data?.answer || 'I could not generate a response.'
        const responseLanguageProfile = result?.data?.languageProfile || {
          language: result?.data?.language || 'english',
        }

        let ttsOptimizedAnswer =
          result?.data?.ttsOptimizedAnswer || answer

        try {
          const optimization = await optimizePronunciation({
            responseText: answer,
            languageProfile: responseLanguageProfile,
          }).unwrap()

          ttsOptimizedAnswer =
            optimization?.data?.ttsOptimizedResponse || ttsOptimizedAnswer
        } catch {
          ttsOptimizedAnswer = ttsOptimizedAnswer || answer
        }

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
            sessionId: analysis?.sessionId || sessionId,
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
      analyze,
      generateResponse,
      sessionId,
      synthesizeVoice,
      selectedVoiceProfile,
      optimizePronunciation,
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
