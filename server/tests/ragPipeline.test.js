import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runRetrieval } from '../src/services/retrieval.layer.service.js'

process.env.VECTOR_SEARCH_INDEX = process.env.VECTOR_SEARCH_INDEX || 'test-index'

test('runRetrieval orchestrates query intelligence, hybrid retrieval, reranking, compression, and grounding payload', async () => {
  const result = await runRetrieval(
    {
      query: 'Scanner issue aa raha hai',
      sessionId: 'session-1',
      conversationHistory: [{ role: 'user', content: 'Scanner setup ka process batao' }],
    },
    {
      ConversationProfileModel: {
        findOne: () => ({
          lean: async () => ({
            language: 'hinglish',
            hinglishStyle: 'business',
            formality: 'professional',
            persona: 'manager',
          }),
        }),
      },
      analyzeQueryIntelligenceFn: () => ({
        queryType: 'troubleshooting',
        domain: 'scanner',
        normalizedQuery: 'scanner issue',
        expandedQueries: ['scanner issue', 'barcode scanner troubleshooting'],
      }),
      runHybridRetrievalFn: async () => ({
        candidates: [
          {
            chunkText: 'Scanner troubleshooting steps for read errors.',
            metadata: { documentType: 'scanner', source: 'scanner-guide.txt' },
            documentName: 'scanner-guide.txt',
            chunkIndex: 0,
            vectorScore: 0.9,
            keywordScore: 0.8,
          },
        ],
        usage: { model: 'test', totalTokens: 10 },
        metrics: { vectorSearchTime: 5, keywordSearchTime: 4 },
      }),
      rerankCandidatesFn: () => ({
        ranked: [
          {
            chunkText: 'Scanner troubleshooting steps for read errors.',
            metadata: { documentType: 'scanner', source: 'scanner-guide.txt' },
            documentName: 'scanner-guide.txt',
            chunkIndex: 0,
            finalScore: 0.88,
          },
        ],
        topCandidates: [
          {
            chunkText: 'Scanner troubleshooting steps for read errors.',
            metadata: { documentType: 'scanner', source: 'scanner-guide.txt' },
            documentName: 'scanner-guide.txt',
            chunkIndex: 0,
            finalScore: 0.88,
          },
        ],
      }),
      compressContextFn: () => ({
        contextText: '[Chunk 1] Scanner troubleshooting steps for read errors.',
        citations: [{ index: 1, documentName: 'scanner-guide.txt' }],
        sourceChunks: [{ documentName: 'scanner-guide.txt', chunkIndex: 0 }],
        stats: { chunksUsed: 1 },
      }),
    },
  )

  assert.ok(result.context)
  assert.ok(Array.isArray(result.citations))
  assert.ok(Array.isArray(result.sourceChunksUsed))
  assert.ok(result.retrievalScore >= 0)
  assert.ok(result.metrics.totalRetrievalTime >= 0)
  assert.deepEqual(result.grounding.citations, result.citations)
})
