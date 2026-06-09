const FORMULA_TERMS = [
  'formula',
  'calculation',
  'rate',
  'pricing',
  'gold purity',
  '14k',
  '18k',
  '22k',
  '24k',
  'mcx',
  'making charges',
  'gst',
  'valuation',
]

function normalize(text = '') {
  return String(text || '').toLowerCase()
}

function countMatches(text = '', terms = []) {
  const source = normalize(text)
  let count = 0
  for (const term of terms) {
    if (!term) continue
    if (source.includes(term)) count += 1
  }
  return count
}

function isFormulaDocument(candidate) {
  const docType = normalize(candidate?.metadata?.documentType)
  if (docType === 'formula') return true
  if (docType === 'pricing') return true
  return false
}

function isFormulaText(candidate) {
  const text = normalize(candidate?.chunkText)
  return countMatches(text, FORMULA_TERMS) >= 2
}

export function shouldUseFormulaPath(queryIntelligence = {}) {
  const normalizedQuery = normalize(queryIntelligence?.normalizedQuery)
  if (!normalizedQuery) return false

  if (queryIntelligence?.intent === 'formula_lookup') return true
  if (queryIntelligence?.domain === 'formula') return true
  if (queryIntelligence?.domain === 'pricing' && queryIntelligence?.signals?.hasCarat) return true

  return countMatches(normalizedQuery, FORMULA_TERMS) >= 2
}

export function buildFormulaExpandedQueries(queryIntelligence = {}) {
  const normalizedQuery = normalize(queryIntelligence?.normalizedQuery)
  const queries = new Set([
    normalizedQuery,
    'gold pricing formula',
    'gold purity calculation 14k 18k 22k 24k',
    'mcx rate making charges gst formula',
  ])

  if (/14k|18k|22k|24k/.test(normalizedQuery)) {
    queries.add('carat wise formula lookup')
    queries.add('gold purity conversion formula')
  }

  if (/making charges|gst/.test(normalizedQuery)) {
    queries.add('making charges gst pricing formula')
  }

  return Array.from(queries).filter(Boolean)
}

export function boostFormulaCandidates(candidates = [], queryIntelligence = {}) {
  const queryText = normalize(queryIntelligence?.normalizedQuery)

  return candidates
    .map((candidate) => {
      const formulaDocBoost = isFormulaDocument(candidate) ? 0.25 : 0
      const formulaTextBoost = isFormulaText(candidate) ? 0.2 : 0
      const lexicalBoost = Math.min(countMatches(candidate?.chunkText, FORMULA_TERMS) * 0.03, 0.2)
      const queryAlignmentBoost = Math.min(countMatches(queryText, FORMULA_TERMS) * 0.02, 0.12)

      const formulaBoost = Number((formulaDocBoost + formulaTextBoost + lexicalBoost + queryAlignmentBoost).toFixed(4))

      return {
        ...candidate,
        formulaBoost,
        vectorScore: Number(Math.min(1, Number(candidate?.vectorScore ?? candidate?.score ?? 0) + formulaBoost).toFixed(4)),
        score: Number(Math.min(1, Number(candidate?.score ?? candidate?.vectorScore ?? 0) + formulaBoost).toFixed(4)),
        keywordScore: Number(Math.min(1, Number(candidate?.keywordScore ?? 0) + formulaBoost * 0.8).toFixed(4)),
      }
    })
    .sort((a, b) => Number(b.formulaBoost || 0) - Number(a.formulaBoost || 0))
}

export function pickFormulaCandidates(candidates = [], limit = 12) {
  return candidates
    .filter((candidate) => isFormulaDocument(candidate) || isFormulaText(candidate))
    .slice(0, Math.max(1, limit))
}
