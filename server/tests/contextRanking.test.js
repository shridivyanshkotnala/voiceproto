import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankContextCandidates } from '../src/services/contextRanking.service.js'

test('context ranking prioritizes pricing formula chunks and limits top results', () => {
  const result = rankContextCandidates({
    query: 'How is pricing calculated?',
    queryIntelligence: {
      normalizedQuery: 'how is pricing calculated',
      domain: 'pricing',
      queryType: 'formula',
    },
    candidates: [
      {
        chunkText: 'Formula: Final Price = Gold Rate x Weight + Making Charges + GST.',
        metadata: { documentType: 'formula' },
        vectorScore: 0.88,
        finalScore: 0.9,
      },
      {
        chunkText: 'Pricing rule depends on approved margin and discount policy.',
        metadata: { documentType: 'pricing' },
        vectorScore: 0.81,
        finalScore: 0.83,
      },
      {
        chunkText: 'Scanner hardware troubleshooting and cable replacement.',
        metadata: { documentType: 'scanner' },
        vectorScore: 0.75,
        finalScore: 0.7,
      },
    ],
    limit: 3,
  })

  assert.equal(result.route.name, 'pricing-formula')
  assert.equal(result.selected.length <= 3, true)
  assert.equal(result.selected[0].metadata.documentType, 'formula')
  assert.ok(
    result.selected.findIndex((item) => item.metadata.documentType === 'scanner') > 0,
  )
})

test('definition intent route keeps glossary-like content', () => {
  const result = rankContextCandidates({
    query: 'What is gross weight?',
    queryIntelligence: {
      normalizedQuery: 'what is gross weight',
      domain: 'faq',
      queryType: 'faq',
    },
    candidates: [
      {
        chunkText: 'Definition: Gross weight includes metal, stones, and fittings.',
        metadata: { documentType: 'definition' },
        vectorScore: 0.8,
        finalScore: 0.82,
      },
      {
        chunkText: 'Inventory scanner setup process for barcode handshakes.',
        metadata: { documentType: 'scanner' },
        vectorScore: 0.82,
        finalScore: 0.81,
      },
    ],
    limit: 3,
  })

  assert.equal(result.route.name, 'definition')
  assert.equal(result.selected[0].metadata.documentType, 'definition')
})
