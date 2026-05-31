import mongoose from 'mongoose'

const aiUsageSchema = new mongoose.Schema(
  {
    organizationId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    feature: { type: String, required: true, index: true },
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true },
    outputTokens: { type: Number, required: true },
    totalTokens: { type: Number, required: true },
    estimatedCost: { type: Number, required: true },
    requestType: { type: String, required: true },
    voiceProfile: { type: String },
    characterCount: { type: Number },
    audioDuration: { type: Number },
    generationTime: { type: Number },
    provider: { type: String },
  },
  { timestamps: true },
)

aiUsageSchema.index({ createdAt: 1 })

export const AiUsage = mongoose.model('AiUsage', aiUsageSchema)
