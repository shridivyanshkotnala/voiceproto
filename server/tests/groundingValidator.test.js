import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildControlledUncertaintyMessage,
  validateGrounding,
} from '../src/services/groundingValidator.service.js'
import { evaluateAnswerQuality } from '../src/services/answerEvaluator.service.js'

test('grounding validator marks low confidence when context missing', () => {
  const result = validateGrounding({
    retrievalResult: {
      retrievalScore: 0.2,
      retrieval: { totalMatches: 0 },
      citations: [],
      metrics: { contextTokens: 0 },
      context: null,
      quality: { formulaPathUsed: false },
    },
    queryIntelligence: {
      intent: 'formula_lookup',
      signals: { hasFormula: true },
    },
  })

  assert.equal(result.lowConfidence, true)
  assert.ok(result.groundingScore < 0.45)
})

test('grounding validator returns medium-high confidence on strong retrieval', () => {
  const result = validateGrounding({
    retrievalResult: {
      retrievalScore: 0.86,
      retrieval: { totalMatches: 4 },
      citations: [{ index: 1 }, { index: 2 }, { index: 3 }],
      metrics: { contextTokens: 160 },
      context: 'Strong context block',
      quality: { formulaPathUsed: true },
    },
    queryIntelligence: {
      intent: 'formula_lookup',
      signals: { hasFormula: true },
    },
  })

  assert.equal(result.lowConfidence, false)
  assert.ok(result.groundingScore >= 0.6)
})

test('controlled uncertainty message returns hinglish style by default', () => {
  const message = buildControlledUncertaintyMessage({
    query: '14k ka formula kya hai',
  })

  assert.match(message, /verified context|enough/i)
})

test('answer evaluator produces numeric quality score', () => {
  const quality = evaluateAnswerQuality({
    answer: 'Ji Sir, formula: Final Price = Gold Rate x Weight + Making Charges + GST.',
    query: '14k formula batao',
    retrievalResult: {
      retrievalScore: 0.82,
      retrieval: { averageScore: 0.82 },
    },
    grounding: {
      groundingScore: 0.78,
    },
    queryIntelligence: {
      intent: 'formula_lookup',
      signals: { hasFormula: true },
      originalQuery: '14k formula batao',
    },
  })

  assert.ok(Number.isFinite(quality.score))
  assert.ok(quality.score >= 70)
  assert.ok(quality.components.formulaCorrectness >= 70)
})
