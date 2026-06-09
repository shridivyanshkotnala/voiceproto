import { ApiError } from '../utils/ApiError.js'
import {
  DEFAULT_VOICE_PROFILE,
  resolveVoiceProfile,
} from '../constants/voice.constants.js'
import { streamElevenLabsTTS } from './voiceStreaming.service.js'
import { saveUsageRecord } from './usageTracking.service.js'

const DEFAULT_MODEL = 'eleven_multilingual_v2'
const DEFAULT_REALTIME_MODEL = 'eleven_flash_v2_5'

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

function getRealtimeVoiceSettings() {
  const stability = Number(process.env.REALTIME_ELEVENLABS_STABILITY ?? 0.25)
  const similarityBoost = Number(
    process.env.REALTIME_ELEVENLABS_SIMILARITY_BOOST ?? 0.65,
  )
  const style = Number(process.env.REALTIME_ELEVENLABS_STYLE ?? 0)
  const useSpeakerBoost = String(
    process.env.REALTIME_ELEVENLABS_SPEAKER_BOOST ?? 'false',
  )

  return {
    stability,
    similarity_boost: similarityBoost,
    style,
    use_speaker_boost: useSpeakerBoost === 'true',
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
// Input: { text, voiceProfile, sessionId, realtimeMode }
// Output: { stream, contentType, audioDuration }
export async function synthesizeVoice({ text, voiceProfile, sessionId, realtimeMode = false }) {
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

  const modelId = realtimeMode
    ? process.env.REALTIME_ELEVENLABS_TTS_MODEL ||
      process.env.ELEVENLABS_TTS_MODEL ||
      DEFAULT_REALTIME_MODEL
    : process.env.ELEVENLABS_TTS_MODEL || DEFAULT_MODEL
  const voiceSettings = realtimeMode ? getRealtimeVoiceSettings() : getVoiceSettings()
  const outputFormat = realtimeMode
    ? process.env.REALTIME_ELEVENLABS_TTS_OUTPUT_FORMAT ||
      process.env.ELEVENLABS_TTS_OUTPUT_FORMAT ||
      'webm_44100_128'
    : process.env.ELEVENLABS_TTS_OUTPUT_FORMAT
  const optimizeStreamingLatency = realtimeMode
    ? Number(process.env.REALTIME_ELEVENLABS_OPTIMIZE_STREAMING_LATENCY ?? 3)
    : Number(process.env.ELEVENLABS_OPTIMIZE_STREAMING_LATENCY ?? NaN)
  const startedAt = Date.now()

  const { stream, headers, contentType } = await streamElevenLabsTTS({
    text: trimmedText,
    voiceId: resolved.voiceId,
    modelId,
    voiceSettings,
    outputFormat,
    optimizeStreamingLatency,
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
    contentType: contentType || 'audio/webm; codecs=opus',
    audioDuration,
  }
}