import { spawn } from 'node:child_process'
import fs from 'fs/promises'
import path from 'path'

const ROOT_DIR = process.cwd()
const REPORTS_DIR = path.resolve(ROOT_DIR, '..', 'reports')
const PORT = Number(process.env.WEBRTC_QA_PORT || 8765)
const BASE_URL = `http://localhost:${PORT}`
const CONCURRENCY_LEVELS = [25, 50, 100]

function sleep(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration))
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

async function runWorker(concurrency) {
  return new Promise((resolve, reject) => {
    const worker = spawn('node', ['scripts/webrtcLoadWorker.js'], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        WEBRTC_QA_BASE_URL: BASE_URL,
        WEBRTC_LOAD_CONCURRENCY: String(concurrency),
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

async function updateReport(scenarios) {
  await fs.mkdir(REPORTS_DIR, { recursive: true })
  const rampMs = Number(process.env.WEBRTC_LOAD_RAMP_MS || 10)
  const timeoutMs = Number(process.env.WEBRTC_QA_TIMEOUT_MS || 30000)
  const report = {
    generatedAt: new Date().toISOString(),
    status: scenarios.some((item) => item.result === 'fail') ? 'partial' : 'measured',
    notes: `WebRTC load tests executed using mock pipeline. rampMs=${rampMs}, timeoutMs=${timeoutMs}.`,
    scenarios,
  }

  await fs.writeFile(
    path.join(REPORTS_DIR, 'webrtc-load-report.json'),
    JSON.stringify(report, null, 2),
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

  const scenarios = []

  for (const concurrency of CONCURRENCY_LEVELS) {
    const result = await runWorker(concurrency)
    if (!result.payload || result.exitCode !== 0) {
      scenarios.push({
        name: `webrtc-load-${concurrency}`,
        concurrentUsers: concurrency,
        result: 'fail',
        errorRate: null,
        avgConnectTimeMs: null,
        notes: result.stderr || `Worker exit code ${result.exitCode}`,
      })
      continue
    }

    const errorRate = 100 - result.payload.rates.streamingSuccessRate

    scenarios.push({
      name: `webrtc-load-${concurrency}`,
      concurrentUsers: concurrency,
      result: errorRate === 0 ? 'pass' : 'partial',
      errorRate,
      avgConnectTimeMs: result.payload.timing.avgConnectTimeMs,
      rates: result.payload.rates,
    })

    await sleep(200)
  }

  serverProcess.kill('SIGTERM')
  await new Promise((resolve) => {
    serverProcess.on('exit', resolve)
  })

  await updateReport(scenarios)

  console.log(JSON.stringify({ scenarios }, null, 2))
}

main().catch((error) => {
  console.error('WebRTC load runner failed:', error)
  process.exit(1)
})
