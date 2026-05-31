import mongoose from 'mongoose'

const knowledgeChunkSchema = new mongoose.Schema(
  {
    documentId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    documentName: { type: String, required: true, index: true },
    chunkIndex: { type: Number, required: true },
    chunkText: { type: String, required: true },
    embedding: { type: [Number], required: true },
    metadata: { type: Object, default: {} },
  },
  { timestamps: true, collection: 'knowledge_chunks' },
)

knowledgeChunkSchema.index({ documentId: 1, chunkIndex: 1 })

export const KnowledgeChunk = mongoose.model('KnowledgeChunk', knowledgeChunkSchema)
