import { KnowledgeChunk } from '../models/knowledgeChunk.model.js'

// Stores knowledge chunks with embeddings.
// Input: chunk documents array
// Output: inserted records
export async function storeChunks(chunks) {
  return KnowledgeChunk.insertMany(chunks)
}

// Deletes chunks for a document (future updates).
// Input: documentId
// Output: delete result
export async function deleteChunksByDocument(documentId) {
  return KnowledgeChunk.deleteMany({ documentId })
}

// Performs MongoDB Atlas vector search for similar chunks.
// Input: queryEmbedding, topK, indexName
// Output: matched chunks with scores
export async function searchSimilarChunks({ queryEmbedding, topK, indexName }) {
  return KnowledgeChunk.aggregate([
    {
      $vectorSearch: {
        index: indexName,
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(50, topK * 10),
        limit: topK,
      },
    },
    {
      $project: {
        chunkText: 1,
        metadata: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ])
}
