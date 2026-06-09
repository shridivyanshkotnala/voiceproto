import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeQueryIntelligence } from '../src/services/queryIntelligence.service.js'

test('normalizes Hinglish troubleshooting scanner query', () => {
  const result = analyzeQueryIntelligence({
    query: 'Bhai scanner me issue aa raha hai',
    conversationHistory: [],
  })

  assert.equal(result.queryType, 'scanner')
  assert.equal(result.intent, 'troubleshooting')
  assert.equal(result.domain, 'scanner')
  assert.match(result.normalizedQuery, /scanner/) 
  assert.ok(result.expandedQueries.some((item) => /barcode scanning issue/i.test(item)))
})

test('normalizes business Hinglish pricing query', () => {
  const result = analyzeQueryIntelligence({
    query: 'Diamond pricing kaise hoti hai',
    conversationHistory: [],
  })

  assert.equal(result.domain, 'pricing')
  assert.ok(['pricing', 'formula'].includes(result.queryType))
  assert.match(result.normalizedQuery, /diamond pricing|pricing/) 
})

test('expands semantically weak Hinglish query into enriched intent', () => {
  const result = analyzeQueryIntelligence({
    query: 'tts delay kyu hai',
    conversationHistory: [],
  })

  assert.equal(result.domain, 'troubleshooting')
  assert.equal(result.intent, 'troubleshooting')
  assert.match(result.normalizedQuery, /text to speech generation delayed|text to speech/) 
  assert.ok(result.expandedQueries.some((item) => /why is text to speech generation delayed/i.test(item)))
})

test('maps 14k shorthand to formula and pricing semantics', () => {
  const result = analyzeQueryIntelligence({
    query: '14k calculation hoga',
    conversationHistory: [],
  })

  assert.ok(['pricing', 'formula'].includes(result.domain))
  assert.equal(result.intent, 'formula_lookup')
  assert.match(result.normalizedQuery, /14k gold calculation|support 14k/) 
})

test('supports follow-up anchor expansion', () => {
  const result = analyzeQueryIntelligence({
    query: 'Usme barcode ka role kya hai?',
    conversationHistory: [
      { role: 'user', content: 'Inventory workflow ka process samjhao' },
      { role: 'assistant', content: 'Sure' },
    ],
  })

  assert.equal(result.isFollowUp, true)
  assert.ok(result.followUpAnchor.length > 0)
  assert.ok(result.expandedQueries.length >= 2)
})
