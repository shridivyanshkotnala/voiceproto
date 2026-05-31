import mongoose from 'mongoose'

const conversationProfileSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, index: true, unique: true },
    language: { type: String, required: true },
    hinglishStyle: { type: String, required: true },
    formality: { type: String, required: true },
    complexity: { type: String, required: true },
    persona: { type: String, required: true },
    preferredResponseStyle: { type: String, required: true },
    lastIntent: { type: String, required: true },
    confidence: { type: Number, required: true },
  },
  { timestamps: true },
)

export const ConversationProfile = mongoose.model(
  'ConversationProfile',
  conversationProfileSchema,
)
