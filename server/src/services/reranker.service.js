import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function normalizeScore(score) {
  if (!Number.isFinite(score)) return 0
  return Math.min(Math.max(score, 0), 1)
}

function computeDomainScore({ candidate, preferredDocumentTypes }) {
  const docType = String(candidate?.metadata?.documentType || '').toLowerCase()
  if (!docType || !preferredDocumentTypes?.length) return 0
  return preferredDocumentTypes.includes(docType) ? 1 : 0
}

function getPreferredDocumentTypes({ queryType, domain }) {
  const preferred = new Set()
  if (queryType && queryType !== 'general') {
    preferred.add(queryType)
  }
  if (domain && domain !== 'general') {
    preferred.add(domain)
  }

  if (queryType === 'troubleshooting') {
    preferred.add('troubleshooting')
  }

  return Array.from(preferred)
}

function computeLexicalScore({ query, chunkText }) {
  const queryTokens = new Set(tokenize(query))
  if (!queryTokens.size) return 0

  const chunkTokens = new Set(tokenize(chunkText))
  let overlap = 0
  queryTokens.forEach((token) => {
    if (chunkTokens.has(token)) {
      overlap += 1
    }
  })

  return Number((overlap / queryTokens.size).toFixed(4))
}

// Re-ranks candidate chunks using semantic + keyword + domain scores.
// Input: { candidates, queryIntelligence }
// Output: { ranked, preferredDocumentTypes }
export function rerankCandidates({ candidates = [], queryIntelligence }) {
  const preferredDocumentTypes = getPreferredDocumentTypes({
    queryType: queryIntelligence?.queryType,
    domain: queryIntelligence?.domain,
  })

  const weights = RETRIEVAL_CONFIG.RERANK_WEIGHTS

  const ranked = candidates
    .map((candidate) => {
      const semanticScore = normalizeScore(candidate?.vectorScore ?? candidate?.score)
      const keywordScore = normalizeScore(candidate?.keywordScore)
      const domainScore = computeDomainScore({ candidate, preferredDocumentTypes })
      const lexicalScore = computeLexicalScore({
        query: queryIntelligence?.normalizedQuery,
        chunkText: candidate?.chunkText,
      })

      const finalScore =
        semanticScore * Math.max(0, weights.semantic - 0.1) +
        keywordScore * weights.keyword +
        domainScore * weights.domain +
        lexicalScore * 0.1

      return {
        ...candidate,
        semanticScore,
        keywordScore,
        domainScore,
        lexicalScore,
        finalScore: Number(finalScore.toFixed(4)),
      }
    })
    .filter((candidate) => {
      const hasStrongSemantic =
        candidate.semanticScore >= RETRIEVAL_CONFIG.MIN_SIMILARITY_SCORE
      const hasLexicalSupport =
        candidate.keywordScore >= 0.1 || candidate.lexicalScore >= 0.2
      return hasStrongSemantic || hasLexicalSupport
    })
    .sort((a, b) => b.finalScore - a.finalScore)

  return {
    ranked,
    preferredDocumentTypes,
    topCandidates: ranked.slice(0, RETRIEVAL_CONFIG.RAG_RERANK_LIMIT),
  }
}
