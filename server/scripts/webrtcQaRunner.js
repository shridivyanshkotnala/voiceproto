import { spawn } from 'node:child_process'
import fs from 'fs/promises'
import path from 'path'

const ROOT_DIR = process.cwd()
const REPORTS_DIR = path.resolve(ROOT_DIR, '..', 'reports')
const PORT = Number(process.env.WEBRTC_QA_PORT || 8765)
const BASE_URL = `http://localhost:${PORT}`

function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration))
}

function percentile(values, pct) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil((pct / 100) * sorted.length) - 1
  return sorted[Math.max(0, index)]
}

async function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Server startup timeout'))
    }, 10000)

    child.stdout.on('data', (data) => {
      const text = data.toString()
      if (text.includes('Server running on port')) {
        clearTimeout(timeout)
        resolve()
      }
    })

    child.on('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
  })
}

async function runWorker() {
  return new Promise((resolve, reject) => {
    const worker = spawn('node', ['scripts/webrtcQaWorker.js'], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        WEBRTC_QA_BASE_URL: BASE_URL,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    worker.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    worker.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    worker.on('error', (error) => {
      reject(error)
    })

    worker.on('exit', (code) => {
      const lines = stdout.trim().split('\n')
      let payload = null
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        try {
          payload = JSON.parse(lines[i])
          break
        } catch {
          continue
        }
      }

      resolve({ payload, exitCode: code ?? 1, stderr })
    })
  })
}

async function updateReports(summary, latencyStats, workerMeta) {
  await fs.mkdir(REPORTS_DIR, { recursive: true })

  const reliabilityReport = {
    generatedAt: new Date().toISOString(),
    status: 'measured',
    environment: 'local-mock',
    notes: workerMeta?.note || undefined,
    totals: summary.totals,
    rates: summary.rates,
    latency: latencyStats,
    criticalErrors: workerMeta?.criticalErrors || 0,
  }

  await fs.writeFile(
    path.join(REPORTS_DIR, 'webrtc-reliability-report.json'),
    JSON.stringify(reliabilityReport, null, 2),
    'utf8',
  )

  const latencyReportPath = path.join(REPORTS_DIR, 'webrtc-latency-report.json')
  let latencyReport = {
    generatedAt: new Date().toISOString(),
    status: 'partial',
    notes:
      'Server-side unified response latency benchmark complete. Live WebRTC latency metrics not measured in this run.',
    benchmarks: {},
    webrtcRealtime: {},
  }

  try {
    const existing = await fs.readFile(latencyReportPath, 'utf8')
    latencyReport = JSON.parse(existing)
  } catch {
    // ignore
  }

  latencyReport.generatedAt = new Date().toISOString()
  latencyReport.status = 'measured'
  latencyReport.notes = 'Live WebRTC latency metrics captured using mock pipeline.'
  latencyReport.webrtcRealtime = {
    timeToFirstAudioMs: latencyStats.timeToFirstAudio.avg,
    timeToFirstAudioP95Ms: latencyStats.timeToFirstAudio.p95,
    totalResponseTimeMs: latencyStats.totalConversation.avg,
    totalResponseTimeP95Ms: latencyStats.totalConversation.p95,
  }

  await fs.writeFile(
    latencyReportPath,
    JSON.stringify(latencyReport, null, 2),
    'utf8',
  )
}

async function main() {
  const serverProcess = spawn('node', ['index.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      REALTIME_MOCK: 'true',
      OPENAI_UNIFIED_MOCK: 'true',
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || 'test',
      ELEVENLABS_STT_MODEL_ID: process.env.ELEVENLABS_STT_MODEL_ID || 'test',
      ELEVENLABS_TTS_MODEL: process.env.ELEVENLABS_TTS_MODEL || 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data)
  })

  await waitForServerReady(serverProcess)

  const workerResult = await runWorker()

  serverProcess.kill('SIGTERM')
  await new Promise((resolve) => {
    serverProcess.on('exit', resolve)
  })
  await sleep(200)

  if (!workerResult.payload) {
    throw new Error(workerResult.stderr || 'Worker did not return metrics payload')
  }

  const workerNote =
    workerResult.exitCode === 0
      ? 'Worker completed without fatal errors.'
      : `Worker exited with code ${workerResult.exitCode}.`

  await updateReports(
    { totals: workerResult.payload.totals, rates: workerResult.payload.rates },
    workerResult.payload.latency,
    {
      note: workerNote,
      criticalErrors: workerResult.exitCode === 0 ? 0 : 1,
    },
  )

  console.log(JSON.stringify(workerResult.payload, null, 2))
}

main().catch((error) => {
  console.error('WebRTC QA runner failed:', error)
  process.exit(1)
})
