export const VOICE_PROFILES = {
  PROFESSIONAL_FEMALE: {
    key: 'PROFESSIONAL_FEMALE',
    label: 'Professional Female',
    envKey: 'ELEVENLABS_PROFESSIONAL_VOICE_ID',
  },
  LUXURY_FEMALE: {
    key: 'LUXURY_FEMALE',
    label: 'Luxury Female',
    envKey: 'ELEVENLABS_LUXURY_VOICE_ID',
  },
  FRIENDLY_FEMALE: {
    key: 'FRIENDLY_FEMALE',
    label: 'Friendly Female',
    envKey: 'ELEVENLABS_FRIENDLY_VOICE_ID',
  },
}

export const DEFAULT_VOICE_PROFILE = 'LUXURY_FEMALE'

// Resolves a configured voice profile from env.
// Input: voiceProfile key
// Output: { voiceId, profile }
export function resolveVoiceProfile(voiceProfile) {
  const profile = VOICE_PROFILES[voiceProfile]
  if (!profile) {
    return null
  }

  const voiceId = process.env[profile.envKey]
  if (!voiceId) {
    return null
  }

  return { voiceId, profile }
}