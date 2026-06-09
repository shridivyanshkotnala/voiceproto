function clamp(value, min = 0, max = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

export function buildControlledUncertaintyMessage({
  query,
  language = 'hinglish',
} = {}) {
  const safeQuery = String(query || '').trim()
  if (String(language).toLowerCase() === 'english') {
    return safeQuery
      ? `I do not have enough verified context to answer "${safeQuery}" confidently. Please provide more details or upload relevant knowledge documents.`
      : 'I do not have enough verified context to answer confidently. Please provide more details or upload relevant knowledge documents.'
  }

  return safeQuery
    ? `Ji Sir, "${safeQuery}" ke liye mere paas abhi enough verified context nahi hai. Kripya thoda aur detail dijiye ya related knowledge upload kijiye.`
    : 'Ji Sir, mere paas abhi enough verified context nahi hai. Kripya thoda aur detail dijiye ya related knowledge upload kijiye.'
}

export function validateGrounding({ retrievalResult, queryIntelligence } = {}) {
  const retrievalScore = clamp(retrievalResult?.retrievalScore || retrievalResult?.retrieval?.averageScore || 0)
  const totalMatches = Number(retrievalResult?.retrieval?.totalMatches || 0)
  const citationsCount = Number(retrievalResult?.citations?.length || 0)
  const contextTokens = Number(retrievalResult?.metrics?.contextTokens || 0)
  const hasContext = Boolean(String(retrievalResult?.context || '').trim())

  const retrievalConfidence = clamp(retrievalScore * 0.8 + Math.min(totalMatches, 5) * 0.04)
  const contextConfidence = clamp(
    (hasContext ? 0.35 : 0) +
    Math.min(citationsCount, 5) * 0.08 +
    (contextTokens >= 80 ? 0.2 : contextTokens >= 40 ? 0.1 : 0),
  )

  const formulaRequired = Boolean(queryIntelligence?.signals?.hasFormula || queryIntelligence?.intent === 'formula_lookup')
  const formulaPenalty = formulaRequired && retrievalResult?.quality?.formulaPathUsed !== true ? 0.12 : 0

  const groundingScore = clamp(retrievalConfidence * 0.55 + contextConfidence * 0.45 - formulaPenalty)
  const lowConfidence = groundingScore < 0.45 || !hasContext

  return {
    retrievalConfidence: Number(retrievalConfidence.toFixed(3)),
    contextConfidence: Number(contextConfidence.toFixed(3)),
    groundingScore: Number(groundingScore.toFixed(3)),
    lowConfidence,
    confidenceTier:
      groundingScore >= 0.8
        ? 'high'
        : groundingScore >= 0.6
          ? 'medium'
          : groundingScore >= 0.45
            ? 'low'
            : 'very_low',
  }
}
