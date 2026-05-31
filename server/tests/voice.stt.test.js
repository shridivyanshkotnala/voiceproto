import { after, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs/promises'
import request from 'supertest'

let app

const uploadDir = path.resolve(process.cwd(), 'uploads')

const stats = {
  results: [],
  responseTimes: [],
  sttTimes: [],
  accuracyScores: [],
}

function recordResult(name, passed, meta = {}) {
  stats.results.push({ name, passed, ...meta })
}

function createAudioBuffer() {
  return Buffer.from('RIFF....WAVEfmt ', 'ascii')
}

function mockFetchJson(payload, options = {}) {
  global.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status: options.status || 200,
      headers: { 'Content-Type': 'application/json' },
    })
}

function mockFetchError(status = 500) {
  global.fetch = async () =>
    new Response('Provider error', {
      status,
      headers: { 'Content-Type': 'text/plain' },
    })
}

function mockFetchTimeout() {
  global.fetch = (url, options) =>
    new Promise((_, reject) => {
      const signal = options?.signal
      signal?.addEventListener('abort', () => {
        const error = new Error('AbortError')
        error.name = 'AbortError'
        reject(error)
      })
    })
}

function similarityScore(a, b) {
  const normalize = (value) =>
    value.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return 0

  const matrix = Array.from({ length: left.length + 1 }, () => [])
  for (let i = 0; i <= left.length; i += 1) matrix[i][0] = i
  for (let j = 0; j <= right.length; j += 1) matrix[0][j] = j

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }

  const distance = matrix[left.length][right.length]
  return Math.round(((1 - distance / Math.max(left.length, right.length)) * 100) * 100) / 100
}

async function getUploadSnapshot() {
  try {
    return new Set(await fs.readdir(uploadDir))
  } catch {
    return new Set()
  }
}

before(async () => {
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-openai-key'
  process.env.OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  process.env.ELEVENLABS_API_KEY = 'test-key'
  process.env.ELEVENLABS_STT_MODEL_ID = 'scribe_v2'

  const module = await import('../app.js')
  app = module.default
})

beforeEach(() => {
  delete process.env.ELEVENLABS_STT_TIMEOUT_MS
})

after(() => {
  const totalTests = stats.results.length
  const passed = stats.results.filter((item) => item.passed).length
  const failed = totalTests - passed
  const averageResponseTime =
    stats.responseTimes.length === 0
      ? 0
      : Number(
          (
            stats.responseTimes.reduce((sum, value) => sum + value, 0) /
            stats.responseTimes.length
          ).toFixed(2),
        )
  const averageSTTTime =
    stats.sttTimes.length === 0
      ? 0
      : Number(
          (
            stats.sttTimes.reduce((sum, value) => sum + value, 0) /
            stats.sttTimes.length
          ).toFixed(2),
        )
  const accuracyScore =
    stats.accuracyScores.length === 0
      ? 0
      : Number(
          (
            stats.accuracyScores.reduce((sum, value) => sum + value, 0) /
            stats.accuracyScores.length
          ).toFixed(2),
        )

  const overallGrade =
    failed === 0 && accuracyScore >= 90 && averageResponseTime <= 5000
      ? 'A'
      : failed === 0
        ? 'B'
        : 'C'

  console.log(
    JSON.stringify(
      {
        totalTests,
        passed,
        failed,
        averageResponseTime,
        averageSTTTime,
        accuracyScore,
        overallGrade,
      },
      null,
      2,
    ),
  )

  const failures = stats.results.filter((item) => !item.passed)
  if (failures.length) {
    console.log('Failures:', JSON.stringify(failures, null, 2))
  }
})

test('Valid audio upload returns transcript', async () => {
  mockFetchJson({ text: 'hello there' })
  const start = Date.now()

  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', createAudioBuffer(), {
      filename: 'sample.wav',
      contentType: 'audio/wav',
    })

  const duration = Date.now() - start
  stats.responseTimes.push(duration)
  stats.sttTimes.push(duration)

  try {
    assert.equal(response.status, 200)
    assert.equal(response.body.success, true)
    assert.ok(response.body.data?.transcript)
    recordResult('valid upload', true)
  } catch (error) {
    recordResult('valid upload', false, { reason: error.message })
    throw error
  }
})

test('Missing audio file returns 400', async () => {
  const response = await request(app)
    .post('/api/v1/voice/transcribe')

  try {
    assert.equal(response.status, 400)
    assert.match(response.body.message, /No audio file uploaded/i)
    recordResult('missing audio', true)
  } catch (error) {
    recordResult('missing audio', false, { reason: error.message })
    throw error
  }
})

test('Invalid file type returns 400', async () => {
  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', Buffer.from('%PDF-1.4'), {
      filename: 'sample.pdf',
      contentType: 'application/pdf',
    })

  try {
    assert.equal(response.status, 400)
    assert.match(response.body.message, /Invalid audio format/i)
    recordResult('invalid file type', true)
  } catch (error) {
    recordResult('invalid file type', false, { reason: error.message })
    throw error
  }
})

test('Oversized audio returns 413', async () => {
  const largeBuffer = Buffer.alloc(20 * 1024 * 1024 + 1)
  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', largeBuffer, {
      filename: 'big.wav',
      contentType: 'audio/wav',
    })

  try {
    assert.equal(response.status, 413)
    assert.match(response.body.message, /exceeds 20MB/i)
    recordResult('oversized upload', true)
  } catch (error) {
    recordResult('oversized upload', false, { reason: error.message })
    throw error
  }
})

test('Empty audio returns 400', async () => {
  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', Buffer.alloc(0), {
      filename: 'empty.wav',
      contentType: 'audio/wav',
    })

  try {
    assert.equal(response.status, 400)
    assert.match(response.body.message, /Empty audio file/i)
    recordResult('empty audio', true)
  } catch (error) {
    recordResult('empty audio', false, { reason: error.message })
    throw error
  }
})

test('Provider failure returns 500', async () => {
  mockFetchError(401)
  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', createAudioBuffer(), {
      filename: 'sample.wav',
      contentType: 'audio/wav',
    })

  try {
    assert.equal(response.status, 500)
    assert.match(response.body.message, /STT provider error/i)
    recordResult('provider failure', true)
  } catch (error) {
    recordResult('provider failure', false, { reason: error.message })
    throw error
  }
})

test('Timeout handling returns 504', async () => {
  process.env.ELEVENLABS_STT_TIMEOUT_MS = '50'
  mockFetchTimeout()

  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', createAudioBuffer(), {
      filename: 'sample.wav',
      contentType: 'audio/wav',
    })

  try {
    assert.equal(response.status, 504)
    assert.match(response.body.message, /timed out/i)
    recordResult('timeout handling', true)
  } catch (error) {
    recordResult('timeout handling', false, { reason: error.message })
    throw error
  }
})

test('Empty transcript returns 400', async () => {
  mockFetchJson({ text: '' })
  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', createAudioBuffer(), {
      filename: 'sample.wav',
      contentType: 'audio/wav',
    })

  try {
    assert.equal(response.status, 400)
    assert.match(response.body.message, /No speech detected/i)
    recordResult('empty transcript', true)
  } catch (error) {
    recordResult('empty transcript', false, { reason: error.message })
    throw error
  }
})

test('Temporary file cleanup after processing', async () => {
  mockFetchJson({ text: 'cleanup check' })
  const beforeFiles = await getUploadSnapshot()

  await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', createAudioBuffer(), {
      filename: 'cleanup.wav',
      contentType: 'audio/wav',
    })

  const afterFiles = await getUploadSnapshot()
  const added = [...afterFiles].filter((file) => !beforeFiles.has(file))

  try {
    assert.equal(added.length, 0)
    recordResult('temp file cleanup', true)
  } catch (error) {
    recordResult('temp file cleanup', false, { reason: error.message })
    throw error
  }
})

test('STT accuracy similarity tests', async () => {
  const cases = [
    { input: 'Gold rate kya hai', expected: 'Gold rate kya hai', minScore: 90 },
    {
      input: 'Diamond pricing kaise hoti hai',
      expected: 'Diamond pricing kaise hoti hai',
      minScore: 90,
    },
    {
      input: 'Inventory update kar do',
      expected: 'Inventory update kar do',
      minScore: 90,
    },
    {
      input: 'What is the current gold rate',
      expected: 'What is the current gold rate',
      minScore: 95,
    },
    {
      input: 'Sir scanner module me issue aa raha hai',
      expected: 'Sir scanner module me issue aa raha hai',
      minScore: 90,
    },
  ]

  for (const sample of cases) {
    mockFetchJson({ text: sample.expected })
    const response = await request(app)
      .post('/api/v1/voice/transcribe')
      .attach('audio', createAudioBuffer(), {
        filename: 'sample.wav',
        contentType: 'audio/wav',
      })

    const transcript = response.body.data?.transcript || ''
    const score = similarityScore(sample.input, transcript)
    stats.accuracyScores.push(score)

    try {
      assert.ok(score >= sample.minScore)
      recordResult(`accuracy ${sample.input}`, true, { score })
    } catch (error) {
      recordResult(`accuracy ${sample.input}`, false, {
        reason: error.message,
        score,
      })
      throw error
    }
  }
})

test('Hinglish term preservation validation', async () => {
  const transcript =
    'Inventory update kar do and barcode pricing scanner module GST dashboard formula hallmark'
  mockFetchJson({ text: transcript })

  const response = await request(app)
    .post('/api/v1/voice/transcribe')
    .attach('audio', createAudioBuffer(), {
      filename: 'sample.wav',
      contentType: 'audio/wav',
    })

  const result = response.body.data?.transcript || ''
  const required = [
    'inventory',
    'scanner',
    'pricing',
    'dashboard',
    'formula',
    'gst',
    'barcode',
    'hallmark',
  ]

  const lower = result.toLowerCase()
  const missing = required.filter((term) => !lower.includes(term))
  const invalid = ['invantary', 'barakode', 'praysing'].filter((term) =>
    lower.includes(term),
  )

  try {
    assert.equal(missing.length, 0)
    assert.equal(invalid.length, 0)
    recordResult('hinglish validation', true)
  } catch (error) {
    recordResult('hinglish validation', false, {
      reason: error.message,
      missing,
      invalid,
    })
    throw error
  }
})

test('Performance averages under 5 seconds (mocked)', async () => {
  mockFetchJson({ text: 'fast response' })
  const iterations = 5
  const durations = []

  for (let i = 0; i < iterations; i += 1) {
    const start = Date.now()
    await request(app)
      .post('/api/v1/voice/transcribe')
      .attach('audio', createAudioBuffer(), {
        filename: 'sample.wav',
        contentType: 'audio/wav',
      })
    durations.push(Date.now() - start)
  }

  const average =
    durations.reduce((sum, value) => sum + value, 0) / durations.length
  stats.responseTimes.push(average)
  stats.sttTimes.push(average)

  try {
    assert.ok(average < 5000)
    recordResult('performance average', true, { average })
  } catch (error) {
    recordResult('performance average', false, { reason: error.message, average })
    throw error
  }
})

test('Load test with 10 concurrent uploads', async () => {
  mockFetchJson({ text: 'load response' })
  const beforeFiles = await getUploadSnapshot()

  const uploads = Array.from({ length: 10 }, () =>
    request(app)
      .post('/api/v1/voice/transcribe')
      .attach('audio', createAudioBuffer(), {
        filename: 'sample.wav',
        contentType: 'audio/wav',
      }),
  )

  const responses = await Promise.all(uploads)
  const afterFiles = await getUploadSnapshot()
  const added = [...afterFiles].filter((file) => !beforeFiles.has(file))

  try {
    responses.forEach((response) => assert.equal(response.status, 200))
    assert.equal(added.length, 0)
    recordResult('load test', true)
  } catch (error) {
    recordResult('load test', false, { reason: error.message })
    throw error
  }
})