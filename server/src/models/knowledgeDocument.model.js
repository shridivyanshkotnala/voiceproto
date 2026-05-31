import mongoose from 'mongoose'

const knowledgeDocumentSchema = new mongoose.Schema(
  {
    documentName: { type: String, required: true },
    documentType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    status: { type: String, required: true, default: 'processed' },
    chunkCount: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, collection: 'knowledge_documents' },
)

export const KnowledgeDocument = mongoose.model(
  'KnowledgeDocument',
  knowledgeDocumentSchema,
)
