import { ConversationProfile } from '../models/conversationProfile.model.js'
import { RESPONSE_DEFAULTS } from '../constants/response.constants.js'

// Resolves conversation profile or returns default language preferences.
// Input: sessionId
// Output: language profile object
export async function resolveConversationProfile(sessionId) {
  if (!sessionId) {
    return { ...RESPONSE_DEFAULTS }
  }

  const profile = await ConversationProfile.findOne({ sessionId }).lean()
  if (!profile) {
    return { ...RESPONSE_DEFAULTS }
  }

  return {
    language: profile.language || RESPONSE_DEFAULTS.language,
    hinglishStyle: profile.hinglishStyle || RESPONSE_DEFAULTS.hinglishStyle,
    formality: profile.formality || RESPONSE_DEFAULTS.formality,
    persona: profile.persona || RESPONSE_DEFAULTS.persona,
    preferredResponseStyle:
      profile.preferredResponseStyle || RESPONSE_DEFAULTS.preferredResponseStyle,
  }
}
