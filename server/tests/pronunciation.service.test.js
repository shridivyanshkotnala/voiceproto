import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { optimizePronunciation } from '../src/services/pronunciation.service.js'
import { HINDI_WORD_MAP } from '../src/constants/pronunciation.constants.js'

process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key'
process.env.OPENAI_PRONUNCIATION_MODEL =
  process.env.OPENAI_PRONUNCIATION_MODEL || 'gpt-4o-mini'
process.env.NODE_ENV = 'test'
process.env.OPENAI_PRONUNCIATION_MOCK = 'true'
process.env.DISABLE_USAGE_TRACKING = 'true'

const stats = {
  results: [],
  executionTimes: [],
}

function recordResult(name, passed, meta = {}) {
  stats.results.push({ name, passed, ...meta })
}

function sentenceCount(text) {
  return (text.match(/[.!?]+/g) || []).length || 1
}

function extractEnglishTokens(text) {
  return (text.match(/[A-Za-z.]+/g) || [])
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 1)
    .filter((token) => !['x', 'k'].includes(token))
    .filter((token) => !HINDI_WORD_MAP[token])
}

function missingTokens(source, target) {
  return source.filter((token) => !target.includes(token))
}

async function runCase(name, { responseText, languageProfile, expected }) {
  const start = Date.now()
  const result = await optimizePronunciation({ responseText, languageProfile })
  stats.executionTimes.push(Date.now() - start)

  try {
    assert.equal(result.ttsOptimizedResponse, expected)
    recordResult(name, true)
  } catch (error) {
    recordResult(name, false, { reason: error.message })
    throw error
  }
}

test('Test 1: Hindi word conversion', async () => {
  await runCase('Hindi word conversion', {
    responseText:
      'mera naam divyansh hai aur mera kaam inventory manage karna hai',
    languageProfile: { language: 'hinglish' },
    expected:
      'मेरा नाम दिव्यांश है और मेरा काम inventory manage करना है',
  })
})

test('Test 2: Multi-sentence Hinglish', async () => {
  await runCase('Multi-sentence Hinglish', {
    responseText: 'bad mein shop close karna bhi meri job hai',
    languageProfile: { language: 'hinglish' },
    expected: 'बाद में shop close करना भी मेरी job है',
  })
})

test('Test 3: Business word preservation', async () => {
  await runCase('Business word preservation', {
    responseText: 'inventory pricing dashboard scanner barcode formula',
    languageProfile: { language: 'hinglish' },
    expected: 'inventory pricing dashboard scanner barcode formula',
  })
})

test('Test 4: Name conversion', async () => {
  await runCase('Name conversion', {
    responseText: 'Divyansh Kotnala inventory manage karta hai',
    languageProfile: { language: 'hinglish' },
    expected: 'दिव्यांश कोटनाला inventory manage करता है',
  })
})

test('Test 5: Indian proper nouns', async () => {
  await runCase('Indian proper nouns', {
    responseText: 'INS Vikrant aur Aryabhatta project',
    languageProfile: { language: 'hinglish' },
    expected: 'INS विक्रांत और आर्यभट्ट project',
  })
})

test('Test 6: City names unchanged', async () => {
  await runCase('City names unchanged', {
    responseText: 'Delhi Mumbai Bengaluru',
    languageProfile: { language: 'hinglish' },
    expected: 'Delhi Mumbai Bengaluru',
  })
})

test('Test 7: Number expansion', async () => {
  await runCase('Number expansion', {
    responseText: 'There are 14 people in the house',
    languageProfile: { language: 'english' },
    expected: 'There are fourteen people in the house',
  })
})

test('Test 8: Multiple numbers', async () => {
  await runCase('Multiple numbers', {
    responseText: 'Gold purity 14 18 22 24',
    languageProfile: { language: 'english' },
    expected: 'Gold purity fourteen eighteen twenty two twenty four',
  })
})

test('Test 9: Carat detection', async () => {
  await runCase('Carat detection', {
    responseText: '24K 22k 18K 14k',
    languageProfile: { language: 'english' },
    expected: '24 Carat 22 Carat 18 Carat 14 Carat',
  })
})

test('Test 10: Math operator expansion', async () => {
  await runCase('Math operator expansion', {
    responseText: 'net weight x gold rate',
    languageProfile: { language: 'english' },
    expected: 'net weight multiply by gold rate',
  })
})

test('Test 11: Multiple operators', async () => {
  await runCase('Multiple operators', {
    responseText: 'A + B - C / D',
    languageProfile: { language: 'english' },
    expected: 'A plus B minus C divided by D',
  })
})

test('Test 12: Formula expansion', async () => {
  await runCase('Formula expansion', {
    responseText: 'Net Weight x Gold Rate + Labour',
    languageProfile: { language: 'english' },
    expected: 'Net Weight multiply by Gold Rate plus Labour',
  })
})

test('Test 13: Original response integrity', async () => {
  const result = await optimizePronunciation({
    responseText: 'mera naam divyansh hai',
    languageProfile: { language: 'hinglish' },
  })

  try {
    assert.equal(result.originalResponse, 'mera naam divyansh hai')
    assert.equal(result.ttsOptimizedResponse, 'मेरा नाम दिव्यांश है')
    recordResult('Original response integrity', true)
  } catch (error) {
    recordResult('Original response integrity', false, { reason: error.message })
    throw error
  }
})

test('Test 14: English mode', async () => {
  await runCase('English mode', {
    responseText: 'There are 24K gold items',
    languageProfile: { language: 'english' },
    expected: 'There are 24 Carat gold items',
  })
})

test('Test 15: English with operators', async () => {
  await runCase('English with operators', {
    responseText: 'Gold Rate = Net Weight x Market Rate',
    languageProfile: { language: 'english' },
    expected: 'Gold Rate equals Net Weight multiply by Market Rate',
  })
})

test('Test 16: TTS pipeline validation', async () => {
  const filePath = path.resolve(
    process.cwd(),
    '..',
    'client',
    'src',
    'hooks',
    'useChat.js',
  )
  const content = await fs.readFile(filePath, 'utf-8')

  try {
    assert.ok(content.includes('ttsOptimizedAnswer'))
    assert.ok(content.includes('synthesizeVoice'))
    recordResult('TTS pipeline validation', true)
  } catch (error) {
    recordResult('TTS pipeline validation', false, { reason: error.message })
    throw error
  }
})

test('Test 17: Frontend displays original answer only', async () => {
  const filePath = path.resolve(
    process.cwd(),
    '..',
    'client',
    'src',
    'hooks',
    'useChat.js',
  )
  const content = await fs.readFile(filePath, 'utf-8')

  try {
    assert.ok(content.includes('content: answer'))
    recordResult('Frontend displays original answer only', true)
  } catch (error) {
    recordResult('Frontend displays original answer only', false, {
      reason: error.message,
    })
    throw error
  }
})

test('Test 18: Meaning preservation heuristics', async () => {
  const original =
    '24K gold ki pricing net weight x market rate se calculate hoti hai.'
  const result = await optimizePronunciation({
    responseText: original,
    languageProfile: { language: 'hinglish' },
  })

  const originalSentences = sentenceCount(original)
  const optimizedSentences = sentenceCount(result.ttsOptimizedResponse)

  const originalEnglish = extractEnglishTokens(original)
  const optimizedEnglish = extractEnglishTokens(result.ttsOptimizedResponse)
  const missing = missingTokens(originalEnglish, optimizedEnglish)

  try {
    assert.equal(originalSentences, optimizedSentences)
    assert.equal(missing.length, 0)
    recordResult('Meaning preservation heuristics', true)
  } catch (error) {
    recordResult('Meaning preservation heuristics', false, {
      reason: error.message,
      missing,
    })
    throw error
  }
})

test('Test 19: Performance test', async () => {
  const samples = Array.from({ length: 100 }, (_, index) =>
    `Sample ${index} 24K gold rate x 2`,
  )

  const start = Date.now()
  for (const sample of samples) {
    await optimizePronunciation({
      responseText: sample,
      languageProfile: { language: 'hinglish' },
    })
  }
  const average = (Date.now() - start) / samples.length

  try {
    assert.ok(average < 100)
    recordResult('Performance test', true, { average })
  } catch (error) {
    recordResult('Performance test', false, { reason: error.message, average })
    throw error
  }
})

test('Test 20: Jewellery business scenario', async () => {
  await runCase('Jewellery business scenario', {
    responseText:
      '24K gold ki pricing net weight x market rate se calculate hoti hai',
    languageProfile: { language: 'hinglish' },
    expected:
      '24 Carat gold की pricing net weight multiply by market rate से calculate होती है',
  })
})

test('Test 21: Provided payload pronunciation optimization', async () => {
  const responseText =
    'Gold ki prices calculate karne ke liye, sabse pehle gold ki weight aur current market rate ka istemal hota hai. Formula hai: Gold Weight × Gold Rate. Gold ki purity bhi pricing par asar dalti hai, jaise 24K, 22K, 18K, ya 14K gold. Higher purity ka matlab hai zyada value.\n\nMarket rates commodity exchanges par track kiye jaate hain, jo global demand, economic conditions, inflation, aur geopolitical events se fluctuate hote hain. Iske alawa, jewellery manufacturing mein wastage charges bhi lagte hain, jo material loss ko compensate karte hain.\n\nToh, gold ki prices ka calculation multiple factors par depend karta hai, jisme metal value, purity, aur market conditions shamil hain.'

  const result = await optimizePronunciation({
    responseText,
    languageProfile: { language: 'hinglish' },
  })

  try {
    assert.equal(result.originalResponse, responseText)
    assert.ok(result.ttsOptimizedResponse.includes('24 Carat, 22 Carat, 18 Carat, ya 14 Carat gold'))
    assert.ok(result.ttsOptimizedResponse.includes('Gold Weight multiply by Gold Rate'))
    assert.ok(result.ttsOptimizedResponse.includes('की'))
    assert.ok(result.ttsOptimizedResponse.includes('है'))
    recordResult('Provided payload pronunciation optimization', true)
  } catch (error) {
    recordResult('Provided payload pronunciation optimization', false, {
      reason: error.message,
    })
    throw error
  }
})

after(() => {
  const totalTests = 21
  const passed = stats.results.filter((item) => item.passed).length
  const failed = totalTests - passed
  const meaningPreservationScore = Math.round(
    (stats.results.find((item) => item.name === 'Meaning preservation heuristics')
      ?.passed
      ? 100
      : 0),
  )
  const businessWordPreservationScore = Math.round(
    (stats.results.find((item) => item.name === 'Business word preservation')
      ?.passed
      ? 100
      : 0),
  )
  const pronunciationImprovementScore = Math.round(
    (stats.results.filter((item) => item.passed).length / totalTests) * 100,
  )
  const averageExecutionTimeMs = stats.executionTimes.length
    ? Number(
        (
          stats.executionTimes.reduce((sum, value) => sum + value, 0) /
          stats.executionTimes.length
        ).toFixed(2),
      )
    : 0

  const overallGrade = failed === 0 ? 'A' : failed <= 2 ? 'B' : 'C'

  console.log(
    JSON.stringify(
      {
        totalTests,
        passed,
        failed,
        meaningPreservationScore,
        businessWordPreservationScore,
        pronunciationImprovementScore,
        averageExecutionTimeMs,
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