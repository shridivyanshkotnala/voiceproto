import { Readable } from 'stream'
import { ApiError } from '../utils/ApiError.js'

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io'

// Streams TTS audio from ElevenLabs.
// Input: { text, voiceId, modelId, voiceSettings }
// Output: { stream, headers }
export async function streamElevenLabsTTS({
  text,
  voiceId,
  modelId,
  voiceSettings,
}) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const baseUrl = process.env.ELEVENLABS_API_URL || DEFAULT_BASE_URL

  if (!apiKey) {
    throw new ApiError(500, 'ElevenLabs API key is not configured.')
  }

  if (!voiceId) {
    throw new ApiError(500, 'ElevenLabs voice ID is not configured.')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 35000)

  try {
    const response = await fetch(`${baseUrl}/v1/text-to-speech/${voiceId}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: voiceSettings,
        output_format: 'mp3_44100_128',
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs TTS error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      })
      throw new ApiError(
        response.status,
        `ElevenLabs TTS failed: ${errorText || response.statusText}`,
      )
    }

    if (!response.body) {
      throw new ApiError(502, 'ElevenLabs did not return an audio stream.')
    }

    return {
      stream: Readable.fromWeb(response.body),
      headers: response.headers,
    }
  } catch (error) {
    console.error('TTS streaming failure:', error)
    if (error.name === 'AbortError') {
      throw new ApiError(504, 'TTS request timed out.')
    }

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(502, 'Unable to reach TTS provider.')
  } finally {
    clearTimeout(timeoutId)
  }
}