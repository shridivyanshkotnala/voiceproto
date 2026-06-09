import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateUnifiedResponse } from '../src/services/responseOrchestrator.service.js'

process.env.NODE_ENV = 'test'
process.env.OPENAI_UNIFIED_MOCK = 'true'
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function buildHistory(count = 6) {
  return Array.from({ length: count }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: `Message ${index + 1}`,
  }))
}

test('Unified response returns displayText, ttsText, profile, usage, and metrics', async () => {
  const result = await generateUnifiedResponse({
    userMessage: 'Inventory management kaise hota hai? ',
    conversationHistory: buildHistory(4),
    retrievedContext: 'Context about inventory management.',
    sessionLanguageProfile: { language: 'hinglish', persona: 'business_owner' },
    retrievalMetadata: { totalMatches: 3, averageScore: 0.62 },
    sessionId: 'test-session',
    latencyMetrics: { retrievalLatency: 12 },
  })

  assert.ok(result.displayText)
  assert.ok(result.ttsText)
  assert.ok(result.languageProfile)
  assert.ok(result.usage)
  assert.ok(result.metrics)
  assert.equal(result.retrievalInfo.chunksUsed, 3)
  assert.equal(result.retrievalInfo.relevanceScore, 0.62)
})

test('Unified response injects memory (last 5 messages) in mock mode', async () => {
  const result = await generateUnifiedResponse({
    userMessage: 'Usme barcode ka role kya hai?',
    conversationHistory: buildHistory(7),
    retrievedContext: 'Barcode enables tracking in inventory.',
    sessionLanguageProfile: { language: 'hinglish', persona: 'manager' },
    retrievalMetadata: { totalMatches: 2, averageScore: 0.55 },
    sessionId: 'test-session-memory',
    latencyMetrics: { retrievalLatency: 10 },
  })

  assert.match(result.displayText, /history:5/)
})

test('Unified response returns fallback when no context is available', async () => {
  const result = await generateUnifiedResponse({
    userMessage: 'Pricing formula kya hai?',
    conversationHistory: buildHistory(2),
    retrievedContext: '',
    sessionLanguageProfile: { language: 'hinglish', persona: 'salesperson' },
    retrievalMetadata: { totalMatches: 0, averageScore: 0 },
    sessionId: 'test-session-fallback',
    latencyMetrics: { retrievalLatency: 5 },
  })

  assert.ok(result.displayText.includes('Mujhe available knowledge base'))
  assert.equal(result.retrievalInfo.chunksUsed, 0)
})
