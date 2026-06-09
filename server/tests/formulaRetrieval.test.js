import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  boostFormulaCandidates,
  buildFormulaExpandedQueries,
  pickFormulaCandidates,
  shouldUseFormulaPath,
} from '../src/services/formulaRetrieval.service.js'

test('formula retrieval path activates for formula lookup signals', () => {
  const enabled = shouldUseFormulaPath({
    domain: 'pricing',
    intent: 'formula_lookup',
    normalizedQuery: '14k gold calculation with making charges',
    signals: { hasCarat: true },
  })

  assert.equal(enabled, true)
})

test('formula retrieval builds rich expanded queries', () => {
  const expanded = buildFormulaExpandedQueries({
    normalizedQuery: '18k mcx making charges formula',
  })

  assert.ok(expanded.some((item) => /gold purity/i.test(item)))
  assert.ok(expanded.some((item) => /making charges/i.test(item)))
})

test('formula candidate boosting prioritizes formula chunks', () => {
  const boosted = boostFormulaCandidates(
    [
      {
        _id: '1',
        metadata: { documentType: 'formula' },
        chunkText: 'Formula: Final Price = Gold Rate x Weight + Making Charges + GST',
        vectorScore: 0.5,
        keywordScore: 0.3,
      },
      {
        _id: '2',
        metadata: { documentType: 'scanner' },
        chunkText: 'Scanner troubleshooting flow for barcode read failure',
        vectorScore: 0.6,
        keywordScore: 0.4,
      },
    ],
    {
      normalizedQuery: '14k gold pricing formula',
    },
  )

  assert.equal(boosted[0]._id, '1')
  assert.ok(boosted[0].formulaBoost > boosted[1].formulaBoost)
})

test('formula candidate picker keeps formula-priority records', () => {
  const picked = pickFormulaCandidates([
    {
      metadata: { documentType: 'scanner' },
      chunkText: 'Scanner reads barcode and qr text',
    },
    {
      metadata: { documentType: 'formula' },
      chunkText: 'Formula for valuation by purity',
    },
  ])

  assert.equal(picked.length, 1)
  assert.equal(picked[0].metadata.documentType, 'formula')
})
