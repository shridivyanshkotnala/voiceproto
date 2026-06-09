import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runHybridRetrieval } from '../src/services/hybridRetrieval.service.js'

process.env.NODE_ENV = 'test'

test('merges vector and keyword candidates with normalized scores', async () => {
  const result = await runHybridRetrieval(
    {
      query: 'scanner issue',
      normalizedQuery: 'scanner issue',
      expandedQueries: ['barcode scanning issue'],
      indexName: 'test-index',
      preferredDocumentTypes: ['scanner', 'troubleshooting'],
      sessionId: 's1',
    },
    {
      generateEmbeddingFn: async () => ({
        embedding: [0.1, 0.2],
        usage: { prompt_tokens: 10 },
        model: 'test-embed',
      }),
      searchSimilarChunksFn: async ({ filter }) => {
        if (filter) {
          return [
            {
              _id: 'a',
              chunkText: 'Scanner is not working after update',
              metadata: { documentType: 'scanner' },
              score: 0.91,
              documentId: 'd1',
              chunkIndex: 1,
            },
          ]
        }
        return []
      },
      searchKeywordChunksFn: async () => [
        {
          _id: 'a',
          chunkText: 'Scanner is not working after update',
          metadata: { documentType: 'scanner' },
          keywordScore: 8,
          documentId: 'd1',
          chunkIndex: 1,
        },
        {
          _id: 'b',
          chunkText: 'Inventory reconciliation checklist',
          metadata: { documentType: 'inventory' },
          keywordScore: 2,
          documentId: 'd2',
          chunkIndex: 3,
        },
      ],
      searchMetadataChunksFn: async () => [
        {
          _id: 'c',
          chunkText: 'Scanner operation workflow reference guide',
          metadata: { documentType: 'operations' },
          metadataScore: 0.35,
          documentId: 'd3',
          chunkIndex: 1,
        },
      ],
      searchDocumentChunksFn: async () => [
        {
          _id: 'd',
          chunkText: 'Report for scanner issue diagnostics',
          metadata: { documentType: 'reports' },
          documentScore: 0.3,
          documentId: 'd4',
          chunkIndex: 2,
        },
      ],
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

  assert.ok(result.candidates.length >= 2)
  assert.ok(result.metrics.vectorSearchTime >= 0)
  assert.ok(result.metrics.keywordSearchTime >= 0)
  assert.ok(result.metrics.metadataSearchTime >= 0)
  assert.ok(result.metrics.documentSearchTime >= 0)
  assert.ok(result.candidates.some((c) => c.vectorScore > 0))
  assert.ok(result.candidates.some((c) => c.keywordScore > 0))
})
