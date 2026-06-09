import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyzeQueryIntelligence } from '../src/services/queryIntelligence.service.js'

const samples = [
  { query: '14k gold formula calculate karo', domain: 'formula', intent: 'formula_lookup' },
  { query: '18k pricing formula with making charges', domain: 'formula', intent: 'formula_lookup' },
  { query: 'gold pricing rate update rule', domain: 'pricing', intent: 'question' },
  { query: 'discount margin pricing policy', domain: 'pricing', intent: 'question' },
  { query: 'scanner barcode qr scan support check', domain: 'scanner', intent: 'feature_check' },
  { query: 'scanner not working issue fix', domain: 'scanner', intent: 'troubleshooting' },
  { query: 'inventory stock ledger reconciliation workflow', domain: 'inventory', intent: 'workflow' },
  { query: 'inventory sync issue troubleshooting', domain: 'inventory', intent: 'troubleshooting' },
  { query: 'report dashboard export analytics', domain: 'reports', intent: 'reporting' },
  { query: 'audit report generation workflow', domain: 'reports', intent: 'reporting' },
  { query: 'operations pipeline workflow steps', domain: 'operations', intent: 'workflow' },
  { query: 'operations process stuck issue', domain: 'operations', intent: 'troubleshooting' },
  { query: 'troubleshoot error timeout fail', domain: 'troubleshooting', intent: 'troubleshooting' },
  { query: 'problem root cause resolution', domain: 'troubleshooting', intent: 'troubleshooting' },
  { query: 'security token permission access issue', domain: 'security', intent: 'troubleshooting' },
  { query: 'security authentication configuration setup', domain: 'security', intent: 'configuration' },
  { query: 'user account staff profile setup', domain: 'users', intent: 'configuration' },
  { query: 'user login customer account question', domain: 'users', intent: 'question' },
  { query: 'system api server configuration', domain: 'system', intent: 'configuration' },
  { query: 'system service workflow process', domain: 'system', intent: 'workflow' },
]

test('classification accuracy stays above 99% on curated benchmark', () => {
  let domainHits = 0
  let intentHits = 0

  for (const sample of samples) {
    const result = analyzeQueryIntelligence({
      query: sample.query,
      conversationHistory: [],
    })

    if (result.domain === sample.domain) {
      domainHits += 1
    }

    if (!sample.intent || result.intent === sample.intent) {
      intentHits += 1
    }
  }

  const domainAccuracy = domainHits / samples.length
  const intentAccuracy = intentHits / samples.length

  assert.ok(domainAccuracy >= 0.99, `Expected domain accuracy >= 0.99, got ${domainAccuracy.toFixed(2)}`)
  assert.ok(intentAccuracy >= 0.99, `Expected intent accuracy >= 0.99, got ${intentAccuracy.toFixed(2)}`)
})
