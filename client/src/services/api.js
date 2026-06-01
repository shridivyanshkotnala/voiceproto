import { getApiBaseUrl } from '../config/apiBaseUrl'

const API_BASE_URL = getApiBaseUrl()

function wait(duration = 700) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

export async function sendMessage({ message, voiceProfile, responseStyle }) {
  // FUTURE: Replace mock mode with real backend call that orchestrates OpenAI + RAG.
  const mockMode = true

  if (mockMode) {
    await wait(900)
    return {
      response: `I understand your query: "${message}". I will answer in ${responseStyle.replace('_', ' ')} using ${voiceProfile.replace('_', ' ')} voice profile when TTS is enabled.`,
    }
  }

  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, voiceProfile, responseStyle }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch chat response')
  }

  return response.json()
}

export async function futureSpeechToText(audioBlob) {
  // FUTURE INTEGRATION POINT: Send `audioBlob` to ElevenLabs STT endpoint.
  // Keep method signature stable so UI integration remains unchanged.
  await wait(500)
  return {
    transcript: '',
    source: audioBlob ? 'pending-elevenlabs-stt' : 'no-audio',
  }
}

export async function futureTextToSpeech(text, voiceProfile) {
  // FUTURE INTEGRATION POINT: Send text + selected voice profile to ElevenLabs TTS.
  await wait(500)
  return {
    audioUrl: '',
    source: text ? `pending-elevenlabs-tts-${voiceProfile}` : 'no-text',
  }
}
