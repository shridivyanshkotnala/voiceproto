import { ApiError } from '../utils/ApiError.js'
import {
  DEFAULT_VOICE_PROFILE,
  resolveVoiceProfile,
} from '../constants/voice.constants.js'
import { streamElevenLabsTTS } from './voiceStreaming.service.js'
import { saveUsageRecord } from './usageTracking.service.js'

const DEFAULT_MODEL = 'eleven_multilingual_v2'

function getVoiceSettings() {
  const stability = Number(process.env.ELEVENLABS_STABILITY ?? 0.4)
  const similarityBoost = Number(process.env.ELEVENLABS_SIMILARITY_BOOST ?? 0.7)
  const style = Number(process.env.ELEVENLABS_STYLE ?? 0.3)
  const useSpeakerBoost = String(process.env.ELEVENLABS_SPEAKER_BOOST ?? 'true')

  return {
    stability,
    similarity_boost: similarityBoost,
    style,
    use_speaker_boost: useSpeakerBoost !== 'false',
  }
}

function parseAudioDuration(headers) {
  const candidates = ['audio-duration', 'x-audio-duration', 'audio-length']
  for (const key of candidates) {
    const value = headers?.get?.(key)
    if (value) {
      const parsed = Number(value)
      if (!Number.isNaN(parsed)) {
        return parsed
      }
    }
  }
  return null
}

// Synthesizes audio for the provided text.
// Input: { text, voiceProfile, sessionId }
// Output: { stream, contentType, audioDuration }
export async function synthesizeVoice({ text, voiceProfile, sessionId }) {
  if (!text || typeof text !== 'string') {
    throw new ApiError(400, 'Text is required')
  }

  const trimmedText = text.trim()
  if (!trimmedText) {
    throw new ApiError(400, 'Text is required')
  }

  const selectedProfile = voiceProfile || DEFAULT_VOICE_PROFILE
  const resolved = resolveVoiceProfile(selectedProfile)

  if (!resolved) {
    throw new ApiError(400, 'Invalid voice profile')
  }

  const modelId = process.env.ELEVENLABS_TTS_MODEL || DEFAULT_MODEL
  const voiceSettings = getVoiceSettings()
  const startedAt = Date.now()

  const { stream, headers } = await streamElevenLabsTTS({
    text: trimmedText,
    voiceId: resolved.voiceId,
    modelId,
    voiceSettings,
  })

  const generationTime = Date.now() - startedAt
  const audioDuration = parseAudioDuration(headers)
  const characterCount = trimmedText.length
  const ratePerThousand = Number(process.env.ELEVENLABS_TTS_COST_PER_1K ?? 0)
  const estimatedCost = Number(
    ((characterCount / 1000) * ratePerThousand).toFixed(6),
  )

  await saveUsageRecord({
    organizationId: 'default',
    sessionId: sessionId || 'anonymous',
    feature: 'tts_generation',
    model: modelId,
    inputTokens: characterCount,
    outputTokens: 0,
    totalTokens: characterCount,
    estimatedCost,
    requestType: 'tts',
    voiceProfile: resolved.profile.key,
    characterCount,
    audioDuration,
    generationTime,
    provider: 'ElevenLabs',
  })

  return {
    stream,
    contentType: 'audio/mpeg',
    audioDuration,
  }
}