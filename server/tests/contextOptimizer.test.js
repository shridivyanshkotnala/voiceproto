import { test } from 'node:test'
import assert from 'node:assert/strict'
import { optimizeContext } from '../src/services/contextOptimizer.service.js'

test('context optimizer removes duplicates and keeps max 3 final chunks', () => {
  const candidates = [
    {
      documentName: 'pricing-1.txt',
      metadata: { documentType: 'pricing', source: 'pricing-1.txt' },
      chunkIndex: 0,
      vectorScore: 0.9,
      finalScore: 0.92,
      chunkText: 'Pricing rule: margin must follow policy slab. GST is applied after making charges.',
    },
    {
      documentName: 'pricing-dup.txt',
      metadata: { documentType: 'pricing', source: 'pricing-dup.txt' },
      chunkIndex: 1,
      vectorScore: 0.89,
      finalScore: 0.9,
      chunkText: 'Pricing rule: margin must follow policy slab. GST is applied after making charges.',
    },
    {
      documentName: 'formula-1.txt',
      metadata: { documentType: 'formula', source: 'formula-1.txt' },
      chunkIndex: 2,
      vectorScore: 0.88,
      finalScore: 0.91,
      chunkText: 'Formula: Final Price = (Gold Rate x Weight) + Making Charges + GST.',
    },
    {
      documentName: 'faq-1.txt',
      metadata: { documentType: 'faq', source: 'faq-1.txt' },
      chunkIndex: 3,
      vectorScore: 0.83,
      finalScore: 0.86,
      chunkText: 'Question: How is pricing calculated? Answer: Use approved formula and apply GST at invoice stage.',
    },
    {
      documentName: 'def-1.txt',
      metadata: { documentType: 'definition', source: 'def-1.txt' },
      chunkIndex: 4,
      vectorScore: 0.84,
      finalScore: 0.85,
      chunkText: 'Definition: Gross weight includes metal weight plus stones and fittings.',
    },
  ]

  const result = optimizeContext({
    candidates,
    query: 'How is pricing calculated?',
    queryIntelligence: {
      normalizedQuery: 'how is pricing calculated',
      domain: 'pricing',
      queryType: 'formula',
    },
  })

  assert.ok(result.contextText.includes('[Formula]'))
  assert.ok(result.stats.finalChunks <= 3)
  assert.ok(result.stats.dedupedChunks < candidates.length)
})

test('context optimizer preserves critical formula and definition content', () => {
  const result = optimizeContext({
    candidates: [
      {
        documentName: 'formula.txt',
        metadata: { documentType: 'formula', source: 'formula.txt' },
        chunkIndex: 0,
        vectorScore: 0.9,
        finalScore: 0.9,
        chunkText: 'Formula: Net Amount = Gold Rate x Net Weight + Making Charges. GST 3% applies.',
      },
      {
        documentName: 'def.txt',
        metadata: { documentType: 'definition', source: 'def.txt' },
        chunkIndex: 1,
        vectorScore: 0.85,
        finalScore: 0.84,
        chunkText: 'Definition: Net weight excludes stones and non-metal components.',
      },
    ],
    query: 'What is net weight formula?',
    queryIntelligence: {
      normalizedQuery: 'what is net weight formula',
      domain: 'formula',
      queryType: 'faq',
    },
  })

  assert.match(result.contextText, /Formula:/i)
  assert.match(result.contextText, /Definition:/i)
  assert.ok(result.stats.contextTokens <= 500)
})
