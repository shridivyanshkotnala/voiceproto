import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rerankCandidates } from '../src/services/reranker.service.js'

test('reranker prioritizes domain and semantic relevance', () => {
  const result = rerankCandidates({
    candidates: [
      {
        chunkText: 'Scanner troubleshooting for barcode read failure',
        metadata: { documentType: 'scanner' },
        vectorScore: 0.84,
        keywordScore: 0.6,
      },
      {
        chunkText: 'General business article about customer service',
        metadata: { documentType: 'industry_article' },
        vectorScore: 0.79,
        keywordScore: 0.1,
      },
    ],
    queryIntelligence: {
      queryType: 'troubleshooting',
      domain: 'scanner',
      normalizedQuery: 'scanner troubleshooting barcode issue',
    },
  })

  assert.equal(result.topCandidates.length > 0, true)
  assert.equal(result.ranked[0].metadata.documentType, 'scanner')
  assert.ok(result.ranked[0].finalScore >= result.ranked[1].finalScore)
})
