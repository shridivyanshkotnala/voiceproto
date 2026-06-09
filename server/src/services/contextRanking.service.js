import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'

function normalizeScore(value) {
  if (!Number.isFinite(Number(value))) return 0
  return Math.max(0, Math.min(1, Number(value)))
}

function tokenize(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function detectIntentRoute({ query, queryIntelligence }) {
  const normalized = String(queryIntelligence?.normalizedQuery || query || '').toLowerCase()

  if (/(what\s+is|define|definition|glossary|gross\s+weight|kya\s+hai)/i.test(normalized)) {
    return {
      name: 'definition',
      allowedTypes: ['definition', 'glossary', 'faq', 'formula', 'pricing'],
      priorityKeywords: ['definition', 'define', 'meaning', 'gross', 'weight', 'glossary'],
    }
  }

  if (/(pricing|price|rate|formula|calculation|markup|discount)/i.test(normalized)) {
    return {
      name: 'pricing-formula',
      allowedTypes: ['pricing', 'formula', 'faq', 'scanner', 'industry_article'],
      priorityKeywords: [
        'pricing',
        'price',
        'rate',
        'formula',
        'calculation',
        'markup',
        'discount',
        'gold',
        'carat',
        'karat',
        '14k',
        '18k',
        '22k',
        'mcx',
      ],
    }
  }

  if (/(barcode|scanner|scan|inventory)/i.test(normalized)) {
    return {
      name: 'barcode-inventory',
      allowedTypes: ['scanner', 'inventory', 'faq', 'troubleshooting'],
      priorityKeywords: ['barcode', 'scanner', 'scan', 'inventory', 'stock'],
    }
  }

  return {
    name: 'general',
    allowedTypes: [],
    priorityKeywords: tokenize(normalized),
  }
}

function keywordMatchScore({ text, query, route }) {
  const queryTokens = new Set(tokenize(query))
  const routeTokens = new Set([...(route?.priorityKeywords || []), ...queryTokens])
  if (!routeTokens.size) return 0

  const chunkTokens = new Set(tokenize(text))
  let overlap = 0
  routeTokens.forEach((token) => {
    if (chunkTokens.has(token)) overlap += 1
  })

  return normalizeScore(overlap / routeTokens.size)
}

function isTypeAllowed(candidate, route) {
  if (!route?.allowedTypes?.length) return true
  const type = String(candidate?.metadata?.documentType || '').toLowerCase()
  return route.allowedTypes.includes(type)
}

export function rankContextCandidates({ candidates = [], query, queryIntelligence, limit }) {
  const route = detectIntentRoute({ query, queryIntelligence })
  const maxItems = Number(limit || RETRIEVAL_CONFIG.RAG_FINAL_CONTEXT_LIMIT)
  const weights = RETRIEVAL_CONFIG.CONTEXT_RANK_WEIGHTS

  const scored = candidates
    .map((candidate) => {
      const vectorScore = normalizeScore(candidate?.vectorScore ?? candidate?.semanticScore ?? candidate?.score)
      const rerankScore = normalizeScore(candidate?.finalScore ?? candidate?.rerankScore)
      const keywordScore = keywordMatchScore({
        text: candidate?.chunkText,
        query: queryIntelligence?.normalizedQuery || query,
        route,
      })

      const typeAllowed = isTypeAllowed(candidate, route)
      const finalScore =
        vectorScore * weights.vector + rerankScore * weights.rerank + keywordScore * weights.keyword

      return {
        ...candidate,
        vectorScore,
        rerankScore,
        keywordMatchScore: keywordScore,
        routeName: route.name,
        intentTypeAllowed: typeAllowed,
        rankingFinalScore: Number((finalScore + (typeAllowed ? 0.03 : -0.03)).toFixed(4)),
      }
    })
    .filter((candidate) => {
      if (candidate.intentTypeAllowed) return true
      return candidate.keywordMatchScore >= 0.2
    })
    .sort((a, b) => b.rankingFinalScore - a.rankingFinalScore)

  return {
    route,
    ranked: scored,
    selected: scored.slice(0, Math.max(1, maxItems)),
  }
}
