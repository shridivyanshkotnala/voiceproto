import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  allocateTokenBudget,
  enforceContextTokenBudget,
  estimateTokens,
} from '../src/utils/tokenBudget.util.js'

test('allocateTokenBudget keeps context within max budget', () => {
  const budget = allocateTokenBudget({
    totalBudget: 2500,
    systemPromptBudget: 500,
    userQueryBudget: 150,
    responseBudget: 350,
    maxContextBudget: 500,
  })

  assert.equal(budget.availableContext, 500)
})

test('enforceContextTokenBudget trims context blocks when over budget', () => {
  const result = enforceContextTokenBudget({
    contextBlocks: [
      'A'.repeat(600),
      'B'.repeat(600),
      'C'.repeat(600),
    ],
    budgetTokens: 200,
  })

  assert.ok(result.contextText.length > 0)
  assert.ok(result.trimmed)
  assert.ok(result.contextTokens <= 210)
})

test('estimateTokens returns zero for empty text', () => {
  assert.equal(estimateTokens(''), 0)
})
