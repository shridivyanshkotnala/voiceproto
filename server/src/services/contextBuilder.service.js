import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'

// Builds structured context from matched chunks.
// Input: filtered matches
// Output: formatted context string
export function buildContext(matches = []) {
  const selected = matches.slice(0, RETRIEVAL_CONFIG.RAG_FINAL_CONTEXT_LIMIT)

  if (!selected.length) {
    return null
  }

  return selected
    .map((match, index) => `[Chunk ${index + 1}]\n${match.chunkText.trim()}`)
    .join('\n\n')
}
