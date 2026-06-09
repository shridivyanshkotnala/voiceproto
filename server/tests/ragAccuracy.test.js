import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeQueryIntelligence } from '../src/services/queryIntelligence.service.js'
import { rerankCandidates } from '../src/services/reranker.service.js'
import { optimizeContext } from '../src/services/contextOptimizer.service.js'

const knowledge = [
  {
    metadata: { documentType: 'pricing', source: 'knowledge.txt' },
    documentName: 'knowledge.txt',
    chunkText: 'Scanner supports 14k, 18k, 22k gold pricing and valuation using configured calculation rules.',
    vectorScore: 0.88,
  },
  {
    metadata: { documentType: 'scanner', source: 'knowledge.txt' },
    documentName: 'knowledge.txt',
    chunkText: 'System can scan tags even without barcode by reading text directly from tag label.',
    vectorScore: 0.84,
  },
  {
    metadata: { documentType: 'inventory', source: 'knowledge.txt' },
    documentName: 'knowledge.txt',
    chunkText: 'Inventory updates after barcode scan and helps in stock reconciliation reports.',
    vectorScore: 0.82,
  },
]

const queries = [
  { q: '18 carat aur 14 carat gold ki calculation karega?', expected: 'pricing' },
  { q: 'barcode bina tag scan hoga?', expected: 'scanner' },
  { q: 'inventory mismatch report kaise nikale?', expected: 'inventory' },
  { q: '22k valuation support hai?', expected: 'pricing' },
]

function tokenize(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function overlap(q, t) {
  const qTokens = new Set(tokenize(q))
  if (!qTokens.size) return 0
  const tTokens = new Set(tokenize(t))
  let count = 0
  qTokens.forEach((token) => {
    if (tTokens.has(token)) count += 1
  })
  return count / qTokens.size
}

test('RAG benchmark score stays above 0.65', () => {
  const scores = []

  for (const item of queries) {
    const qi = analyzeQueryIntelligence({ query: item.q, conversationHistory: [] })

    const candidates = knowledge.map((chunk) => ({
      ...chunk,
      score: chunk.vectorScore,
      vectorScore: Number((chunk.vectorScore * 0.7 + overlap(qi.normalizedQuery, chunk.chunkText) * 0.3).toFixed(4)),
      keywordScore: Number(overlap(qi.normalizedQuery, chunk.chunkText).toFixed(4)),
    }))

    const reranked = rerankCandidates({ candidates, queryIntelligence: qi })
    const optimized = optimizeContext({
      candidates: reranked.topCandidates,
      query: qi.normalizedQuery,
      queryIntelligence: qi,
    })

    assert.ok(optimized.contextText.length > 0)
    const top = reranked.topCandidates[0]
    const topType = top?.metadata?.documentType
    const score =
      topType === item.expected
        ? Number(top.finalScore || 0)
        : Number((top.finalScore || 0) * 0.75)
    scores.push(score)
  }

  const avg = scores.reduce((sum, val) => sum + val, 0) / scores.length
  assert.ok(avg > 0.65, `Expected avg RAG score > 0.65, got ${avg.toFixed(3)}`)
})
