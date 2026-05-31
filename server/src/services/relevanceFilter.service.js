import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'

// Filters low-quality or duplicate matches.
// Input: array of matches
// Output: filtered matches
export function filterRelevantMatches(matches = []) {
  const seen = new Set()

  return matches
    .filter((match) =>
      typeof match?.score === 'number'
        ? match.score >= RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE
        : false,
    )
    .filter((match) => {
      const text = (match.chunkText || '').trim()
      if (!text) return false
      if (seen.has(text)) return false
      seen.add(text)
      return true
    })
}
