function clamp(value, min = 0, max = 100) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.max(min, Math.min(max, numeric))
}

function includesFormulaTerms(text = '') {
  return /(formula|calculation|rate|carat|14k|18k|22k|24k|making charges|gst|mcx)/i.test(text)
}

function includesBusinessTerms(text = '') {
  return /(valuation|inventory|scanner|barcode|report|workflow|pricing|purity)/i.test(text)
}

export function evaluateAnswerQuality({
  answer,
  query,
  retrievalResult,
  grounding,
  queryIntelligence,
} = {}) {
  const safeAnswer = String(answer || '').trim()
  const safeQuery = String(query || '').trim()
  const retrievalScore = Number(retrievalResult?.retrievalScore || retrievalResult?.retrieval?.averageScore || 0)
  const groundingScore = Number(grounding?.groundingScore || 0)

  const relevance = clamp((retrievalScore * 70 + groundingScore * 30))
  const groundedness = clamp(groundingScore * 100)
  const factualCorrectness = clamp((retrievalScore * 60 + groundingScore * 40) * 100)

  const formulaExpected = Boolean(queryIntelligence?.signals?.hasFormula || queryIntelligence?.intent === 'formula_lookup')
  const formulaCorrectness = formulaExpected
    ? clamp((includesFormulaTerms(safeAnswer) ? 70 : 35) + retrievalScore * 30)
    : 100

  const businessTerminology = clamp((includesBusinessTerms(safeAnswer) ? 75 : 45) + retrievalScore * 25)

  const hinglishExpected = String(queryIntelligence?.originalQuery || safeQuery).match(/[\u0900-\u097F]|\b(kyu|kaise|kya|hisaab|maal)\b/i)
  const hinglishQuality = hinglishExpected
    ? clamp(/\b(ji|sir|hisaab|rate|scanner|report|inventory|pricing)\b/i.test(safeAnswer) ? 88 : 62)
    : 100

  const weighted = clamp(
    factualCorrectness * 0.25 +
    groundedness * 0.25 +
    relevance * 0.2 +
    formulaCorrectness * 0.15 +
    businessTerminology * 0.1 +
    hinglishQuality * 0.05,
  )

  return {
    score: Number(weighted.toFixed(2)),
    components: {
      factualCorrectness: Number(factualCorrectness.toFixed(2)),
      grounding: Number(groundedness.toFixed(2)),
      relevance: Number(relevance.toFixed(2)),
      formulaCorrectness: Number(formulaCorrectness.toFixed(2)),
      businessTerminologyPreservation: Number(businessTerminology.toFixed(2)),
      hinglishQuality: Number(hinglishQuality.toFixed(2)),
    },
  }
}
