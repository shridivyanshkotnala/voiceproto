import { KnowledgeChunk } from '../models/knowledgeChunk.model.js'

function isVectorFilterIndexError(error) {
  const message = String(error?.message || '')
  return (
    /PlanExecutor error during aggregation/i.test(message) &&
    /needs to be indexed as filter/i.test(message)
  )
}

async function runVectorSearch(vectorStage) {
  return KnowledgeChunk.aggregate([
    {
      $vectorSearch: vectorStage,
    },
    {
      $project: {
        chunkText: 1,
        metadata: 1,
        documentId: 1,
        documentName: 1,
        chunkIndex: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ])
}

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
// Input: queryEmbedding, topK, indexName, filter
// Output: matched chunks with scores
export async function searchSimilarChunks({
  queryEmbedding,
  topK,
  indexName,
  filter,
}) {
  const vectorStage = {
    index: indexName,
    path: 'embedding',
    queryVector: queryEmbedding,
    numCandidates: Math.max(50, topK * 10),
    limit: topK,
  }

  if (filter && Object.keys(filter).length) {
    vectorStage.filter = filter
  }

  try {
    return await runVectorSearch(vectorStage)
  } catch (error) {
    if (!vectorStage.filter || !isVectorFilterIndexError(error)) {
      throw error
    }

    console.warn(
      '[vector-search] filter field not mapped in Atlas vector index; retrying without filter.',
      {
        indexName,
        filterKeys: Object.keys(vectorStage.filter || {}),
      },
    )

    const fallbackStage = { ...vectorStage }
    delete fallbackStage.filter

    return runVectorSearch(fallbackStage)
  }
}

// Performs keyword search (text index) for chunks.
// Input: query, topK, filter
// Output: matched chunks with scores
export async function searchKeywordChunks({ query, topK, filter }) {
  const matchStage = {
    $text: { $search: query },
  }

  if (filter && Object.keys(filter).length) {
    Object.assign(matchStage, filter)
  }

  return KnowledgeChunk.aggregate([
    { $match: matchStage },
    { $addFields: { keywordScore: { $meta: 'textScore' } } },
    { $sort: { keywordScore: -1 } },
    { $limit: topK },
    {
      $project: {
        chunkText: 1,
        metadata: 1,
        documentId: 1,
        documentName: 1,
        chunkIndex: 1,
        keywordScore: 1,
      },
    },
  ])
}

function buildLooseRegex(query = '') {
  const safe = String(query || '')
    .replace(/[^a-z0-9\s]/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 8)
  if (!safe.length) return null
  return new RegExp(safe.join('|'), 'i')
}

// Performs metadata-oriented retrieval fallback using document type/source fields.
// Input: query, topK
// Output: matched chunks with metadataScore
export async function searchMetadataChunks({ query, topK = 10 }) {
  const regex = buildLooseRegex(query)
  if (!regex) return []

  return KnowledgeChunk.aggregate([
    {
      $match: {
        $or: [
          { 'metadata.documentType': regex },
          { 'metadata.source': regex },
          { documentName: regex },
        ],
      },
    },
    {
      $addFields: {
        metadataScore: 0.35,
      },
    },
    { $limit: Math.max(1, Number(topK || 10)) },
    {
      $project: {
        chunkText: 1,
        metadata: 1,
        documentId: 1,
        documentName: 1,
        chunkIndex: 1,
        metadataScore: 1,
      },
    },
  ])
}

// Performs document-name retrieval fallback.
// Input: query, topK
// Output: matched chunks with documentScore
export async function searchDocumentChunks({ query, topK = 10 }) {
  const regex = buildLooseRegex(query)
  if (!regex) return []

  return KnowledgeChunk.aggregate([
    {
      $match: {
        documentName: regex,
      },
    },
    {
      $addFields: {
        documentScore: 0.3,
      },
    },
    { $limit: Math.max(1, Number(topK || 10)) },
    {
      $project: {
        chunkText: 1,
        metadata: 1,
        documentId: 1,
        documentName: 1,
        chunkIndex: 1,
        documentScore: 1,
      },
    },
  ])
}
