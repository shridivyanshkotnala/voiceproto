import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeQueryIntelligence } from '../src/services/queryIntelligence.service.js'
import { rerankCandidates } from '../src/services/reranker.service.js'
import { optimizeContext } from '../src/services/contextOptimizer.service.js'
import { createResponseStreamingService } from '../src/services/responseStreaming.service.js'

const chunks = [
  {
    metadata: { documentType: 'pricing', source: 'knowledge.txt' },
    documentName: 'knowledge.txt',
    chunkText: '14k and 18k gold calculations are supported with live rate based valuation.',
    score: 0.82,
    vectorScore: 0.82,
    keywordScore: 0.74,
  },
  {
    metadata: { documentType: 'scanner', source: 'knowledge.txt' },
    documentName: 'knowledge.txt',
    chunkText: 'Scanner can read text tags without barcode and supports jewellery operations.',
    score: 0.7,
    vectorScore: 0.7,
    keywordScore: 0.62,
  },
]

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('end-to-end voice flow reaches answer with valid context and streaming output', async () => {
  const query = '18 carat aur 14 carat gold ki calculation karega?'
  const qi = analyzeQueryIntelligence({ query, conversationHistory: [] })

  const reranked = rerankCandidates({
    candidates: chunks,
    queryIntelligence: qi,
  })

  const optimized = optimizeContext({
    candidates: reranked.topCandidates,
    query: qi.normalizedQuery,
    queryIntelligence: qi,
  })

  assert.ok(optimized.contextText.length > 0)

  const service = createResponseStreamingService()

  async function* stream() {
    const tokens = ['Ji Sir, ', '14k aur 18k ', 'dono calculation ', 'supported hain.']
    for (const token of tokens) {
      await wait(40)
      yield token
    }
  }

  const result = await service.consume({ tokenStream: stream() })

  assert.match(result.text, /14k|18k/i)
  assert.ok(result.metrics.timeToFirstToken >= 0)
})
