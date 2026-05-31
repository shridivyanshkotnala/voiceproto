import { CHUNK_OVERLAP, CHUNK_SIZE } from '../constants/rag.constants.js'

// Splits text into overlapping chunks while preserving sentences.
// Input: raw document text
// Output: array of { chunkIndex, chunkText }
export function chunkDocument(text) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)

  const chunks = []
  let current = ''

  const pushChunk = () => {
    if (!current) return
    const chunkText = current.trim()
    chunks.push({ chunkIndex: chunks.length, chunkText })
    const overlap = chunkText.slice(Math.max(0, chunkText.length - CHUNK_OVERLAP))
    current = overlap
  }

  sentences.forEach((sentence) => {
    if ((current + ' ' + sentence).trim().length > CHUNK_SIZE) {
      pushChunk()
    }
    current = `${current} ${sentence}`.trim()
  })

  if (current.trim()) {
    pushChunk()
  }

  return chunks
}
