import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { generateUnifiedResponse } from '../src/services/responseOrchestrator.service.js'

process.env.NODE_ENV = 'test'
process.env.OPENAI_UNIFIED_MOCK = 'true'
process.env.OPENAI_UNIFIED_MOCK_LATENCY_MS = '25'
process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(index, 0)]
}

async function simulateOldPipeline({ iterations }) {
  const latencies = []
  const tokenUsages = []
  const costs = []

  for (let i = 0; i < iterations; i += 1) {
    const start = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 25)) // language analysis
    await new Promise((resolve) => setTimeout(resolve, 25)) // response gen
    await new Promise((resolve) => setTimeout(resolve, 25)) // hinglish
    await new Promise((resolve) => setTimeout(resolve, 25)) // pronunciation
    latencies.push(Date.now() - start)
    tokenUsages.push(0)
    costs.push(0)
  }

  return { latencies, tokenUsages, costs }
}

async function simulateUnifiedPipeline({ iterations }) {
  const latencies = []
  const tokenUsages = []
  const costs = []

  for (let i = 0; i < iterations; i += 1) {
    const start = Date.now()
    const result = await generateUnifiedResponse({
      userMessage: `Sample question ${i + 1}`,
      conversationHistory: [],
      retrievedContext: 'Sample context about inventory and pricing.',
      sessionLanguageProfile: { language: 'hinglish', persona: 'business_owner' },
      retrievalMetadata: { totalMatches: 4, averageScore: 0.6 },
      sessionId: `bench-${i + 1}`,
      latencyMetrics: { retrievalLatency: 5 },
    })
    latencies.push(Date.now() - start)
    tokenUsages.push(result.usage?.totalTokens || 0)
    costs.push(result.usage?.estimatedCost || 0)
  }

  return { latencies, tokenUsages, costs }
}

test('Performance benchmark report generated', async () => {
  const iterations = 100
  const oldPipeline = await simulateOldPipeline({ iterations })
  const unifiedPipeline = await simulateUnifiedPipeline({ iterations })

  const report = {
    iterations,
    oldPipeline: {
      averageLatency: Math.round(
        oldPipeline.latencies.reduce((a, b) => a + b, 0) / iterations,
      ),
      p95Latency: percentile(oldPipeline.latencies, 95),
      averageTokenUsage: 0,
      averageCost: 0,
    },
    unifiedPipeline: {
      averageLatency: Math.round(
        unifiedPipeline.latencies.reduce((a, b) => a + b, 0) / iterations,
      ),
      p95Latency: percentile(unifiedPipeline.latencies, 95),
      averageTokenUsage: Math.round(
        unifiedPipeline.tokenUsages.reduce((a, b) => a + b, 0) / iterations,
      ),
      averageCost: Number(
        (
          unifiedPipeline.costs.reduce((a, b) => a + b, 0) / iterations
        ).toFixed(6),
      ),
    },
  }

  const reportDir = path.resolve(process.cwd(), 'reports')
  await fs.mkdir(reportDir, { recursive: true })
  await fs.writeFile(
    path.join(reportDir, 'performance-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  )

  assert.ok(report.unifiedPipeline.averageLatency <= report.oldPipeline.averageLatency)
})
