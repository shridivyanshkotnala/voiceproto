import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runHybridRetrieval } from '../src/services/hybridRetrieval.service.js'

process.env.NODE_ENV = 'test'

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

test('retrieval latency remains below 800ms with expanded queries', async () => {
  const startedAt = Date.now()

  const result = await runHybridRetrieval(
    {
      query: '14k aur 18k gold pricing',
      normalizedQuery: '14k 18k gold pricing',
      expandedQueries: ['gold calculation', 'carat valuation', 'mcx live rate'],
      indexName: 'test-index',
      preferredDocumentTypes: ['pricing', 'formula'],
      sessionId: 'latency-test',
    },
    {
      generateEmbeddingFn: async () => {
        await wait(120)
        return {
          embedding: [0.1, 0.2],
          usage: { prompt_tokens: 12 },
          model: 'test-embedding',
        }
      },
      searchSimilarChunksFn: async () => {
        await wait(160)
        return [
          {
            _id: '1',
            chunkText: '14k and 18k pricing supported',
            metadata: { documentType: 'pricing' },
            score: 0.84,
          },
        ]
      },
      searchKeywordChunksFn: async () => {
        await wait(120)
        return [
          {
            _id: '1',
            chunkText: '14k and 18k pricing supported',
            metadata: { documentType: 'pricing' },
            keywordScore: 10,
          },
        ]
      },
      calculateUsageCostFn: ({ model, inputTokens, outputTokens }) => ({
        model,
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        estimatedCost: 0,
      }),
      saveUsageRecordFn: async () => null,
    },
  )

  const elapsed = Date.now() - startedAt

  assert.ok(result.candidates.length > 0)
  assert.ok(result.metrics.vectorSearchTime >= 0)
  assert.ok(result.metrics.keywordSearchTime >= 0)
  assert.ok(elapsed < 800, `Expected retrieval < 800ms, got ${elapsed}ms`)
})
