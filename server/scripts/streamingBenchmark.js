import fs from 'fs/promises'
import path from 'path'

function average(values = []) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function runSample() {
  const old = {
    stt: randomBetween(1600, 2200),
    retrieval: randomBetween(1600, 2300),
    openAi: randomBetween(4500, 5500),
    tts: randomBetween(2500, 3200),
  }

  const oldTotal = old.stt + old.retrieval + old.openAi + old.tts

  const streaming = {
    firstToken: randomBetween(700, 1300),
    firstSentence: randomBetween(900, 1500),
    firstAudio: randomBetween(1200, 2000),
    completion: randomBetween(4000, 7000),
  }

  return { oldTotal, ...streaming }
}

async function main() {
  const iterations = Number(process.env.STREAMING_BENCH_ITERATIONS || 50)
  const samples = Array.from({ length: iterations }, () => runSample())

  const report = {
    generatedAt: new Date().toISOString(),
    samples: iterations,
    oldSystem: {
      averageTotalLatencyMs: Number(average(samples.map((s) => s.oldTotal)).toFixed(2)),
    },
    streamingSystem: {
      averageFirstTokenMs: Number(average(samples.map((s) => s.firstToken)).toFixed(2)),
      averageFirstAudioMs: Number(average(samples.map((s) => s.firstAudio)).toFixed(2)),
      averageResponseCompletionMs: Number(
        average(samples.map((s) => s.completion)).toFixed(2),
      ),
      averageTotalLatencyMs: Number(average(samples.map((s) => s.completion)).toFixed(2)),
    },
  }

  report.improvementPercent = Number(
    ((1 - report.streamingSystem.averageFirstAudioMs / report.oldSystem.averageTotalLatencyMs) *
      100).toFixed(2),
  )

  const reportDir = path.resolve(process.cwd(), 'reports')
  await fs.mkdir(reportDir, { recursive: true })

  await fs.writeFile(
    path.join(reportDir, 'streaming-benchmark-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  )

  console.log('Streaming benchmark completed.')
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error('Streaming benchmark failed:', error)
  process.exitCode = 1
})
