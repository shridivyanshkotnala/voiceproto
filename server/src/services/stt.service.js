import fs from 'fs/promises'
import { Blob } from 'buffer'
import Sanscript from 'sanscript'
import { ApiError } from '../utils/ApiError.js'

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io'

// Handles speech-to-text provider integration.
// Input: filePath, mimeType, fileName
// Output: normalized transcript string.
// Swap strategy: replace this function's internal fetch logic for other STT vendors
// without changing controller or routes.
export async function transcribeAudio(filePath, mimeType, fileName) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const modelId = process.env.ELEVENLABS_STT_MODEL_ID
  const baseUrl = process.env.ELEVENLABS_API_URL || DEFAULT_BASE_URL
  const languageCode = process.env.ELEVENLABS_STT_LANGUAGE_CODE

  if (!apiKey || !modelId) {
    throw new ApiError(500, 'ElevenLabs credentials are not configured.')
  }

  const audioBuffer = await fs.readFile(filePath)
  const audioBlob = new Blob([audioBuffer], { type: mimeType })
  const formData = new FormData()

  formData.append('file', audioBlob, fileName)
  formData.append('model_id', modelId)
  if (languageCode) {
    formData.append('language_code', languageCode)
  }

  const controller = new AbortController()
  const timeoutMs = Number(process.env.ELEVENLABS_STT_TIMEOUT_MS || 30000)
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}/v1/speech-to-text`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs STT error:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
      })
      throw new ApiError(500, 'STT provider error.')
    }

    const data = await response.json()
    let transcript = data.text || data.transcript || data.result || ''

    if (!transcript) {
      throw new ApiError(400, 'No speech detected.')
    }

    const hasDevanagari = /\p{Script=Devanagari}/u.test(transcript)
    const hasUnsupportedScript = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Devanagari}\p{Number}\p{Punctuation}\s]/u.test(
      transcript,
    )

    if (hasUnsupportedScript) {
      throw new ApiError(422, 'Please speak in English or Hinglish only.')
    }

    if (hasDevanagari) {
      transcript = transcript.replace(/\p{Script=Devanagari}+/gu, (chunk) =>
        Sanscript.t(chunk, 'devanagari', 'itrans'),
      )
    }

    return transcript
  } catch (error) {
    console.error('STT service failure:', error)
    if (error.name === 'AbortError') {
      throw new ApiError(504, 'STT request timed out.')
    }

    if (error instanceof ApiError) {
      throw error
    }

    throw new ApiError(502, 'Unable to reach STT provider.')
  } finally {
    clearTimeout(timeoutId)
  }
}
