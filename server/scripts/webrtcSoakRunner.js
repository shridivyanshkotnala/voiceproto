import { spawn } from 'node:child_process'
import fs from 'fs/promises'
import path from 'path'

const ROOT_DIR = process.cwd()
const REPORTS_DIR = path.resolve(ROOT_DIR, '..', 'reports')
const PORT = Number(process.env.WEBRTC_QA_PORT || 8765)
const BASE_URL = `http://localhost:${PORT}`
const ITERATION_LEVELS = [100, 500, 1000]

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

async function runWorker(iterations) {
  return new Promise((resolve, reject) => {
    const worker = spawn('node', ['scripts/webrtcSoakWorker.js'], {
      cwd: ROOT_DIR,
      env: {
        ...process.env,
        WEBRTC_QA_BASE_URL: BASE_URL,
        WEBRTC_SOAK_ITERATIONS: String(iterations),
        WEBRTC_QA_TIMEOUT_MS: String(process.env.WEBRTC_QA_TIMEOUT_MS || 30000),
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

async function updateReports(results) {
  await fs.mkdir(REPORTS_DIR, { recursive: true })

  const report = {
    generatedAt: new Date().toISOString(),
    status: results.some((item) => item.leakSuspected) ? 'partial' : 'measured',
    notes: 'WebRTC soak tests executed using mock pipeline.',
    scenarios: results,
  }

  await fs.writeFile(
    path.join(REPORTS_DIR, 'webrtc-leak-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  )
}

function classifyLeak(growthBytes, iterations) {
  const perSession = growthBytes / Math.max(iterations, 1)
  return perSession > 25000 || growthBytes > 50 * 1024 * 1024
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

  const results = []

  for (const iterations of ITERATION_LEVELS) {
    const workerResult = await runWorker(iterations)
    if (!workerResult.payload || workerResult.exitCode !== 0) {
      results.push({
        name: `webrtc-soak-${iterations}`,
        iterations,
        result: 'fail',
        leakSuspected: true,
        heapGrowthBytes: null,
        heapStartBytes: null,
        heapEndBytes: null,
        heapMaxBytes: null,
        errors: workerResult.payload?.errors || {},
        notes: workerResult.stderr || `Worker exit code ${workerResult.exitCode}`,
      })
      continue
    }

    const growthBytes = workerResult.payload.heapGrowthBytes
    const leakSuspected = classifyLeak(growthBytes, iterations)

    results.push({
      name: `webrtc-soak-${iterations}`,
      iterations,
      result: leakSuspected ? 'partial' : 'pass',
      leakSuspected,
      heapGrowthBytes: growthBytes,
      heapStartBytes: workerResult.payload.heapStartBytes,
      heapEndBytes: workerResult.payload.heapEndBytes,
      heapMaxBytes: workerResult.payload.heapMaxBytes,
      errors: workerResult.payload.errors,
    })
  }

  serverProcess.kill('SIGTERM')
  await new Promise((resolve) => {
    serverProcess.on('exit', resolve)
  })

  await updateReports(results)

  console.log(JSON.stringify({ scenarios: results }, null, 2))
}

main().catch((error) => {
  console.error('WebRTC soak runner failed:', error)
  process.exit(1)
})
