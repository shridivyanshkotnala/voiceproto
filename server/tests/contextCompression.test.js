import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compressContext } from '../src/services/contextCompression.service.js'

test('compresses FAQ content and returns citations/source chunks', () => {
  const result = compressContext({
    query: 'scanner issue troubleshooting',
    candidates: [
      {
        documentName: 'scanner-faq.txt',
        chunkIndex: 2,
        metadata: { documentType: 'faq', source: 'scanner-faq.txt' },
        chunkText: 'Question: Scanner not working?\nAnswer: Restart service and check cable.',
        semanticScore: 0.8,
        keywordScore: 0.7,
        domainScore: 1,
        finalScore: 0.86,
      },
    ],
  })

  assert.ok(result.contextText.includes('Question:'))
  assert.equal(result.citations.length, 1)
  assert.equal(result.sourceChunks.length, 1)
  assert.ok(result.stats.contextChars > 0)
})
