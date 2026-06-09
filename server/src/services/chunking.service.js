import { CHUNK_OVERLAP, CHUNK_SIZE } from '../constants/rag.constants.js'

const FAQ_LINE_PATTERN = /^\s*(q\.?|question)\s*[:.-]\s*/i
const ANSWER_LINE_PATTERN = /^\s*(a\.?|answer)\s*[:.-]\s*/i

function splitFaqBlocks(text) {
  const lines = text.split(/\r?\n/)
  const chunks = []
  let currentQuestion = ''
  let currentAnswer = ''

  const pushChunk = () => {
    const combined = `${currentQuestion}\n${currentAnswer}`.trim()
    if (combined) {
      chunks.push(combined)
    }
    currentQuestion = ''
    currentAnswer = ''
  }

  for (const line of lines) {
    if (FAQ_LINE_PATTERN.test(line)) {
      if (currentQuestion || currentAnswer) {
        pushChunk()
      }
      currentQuestion = line.replace(FAQ_LINE_PATTERN, 'Question: ').trim()
      continue
    }

    if (ANSWER_LINE_PATTERN.test(line)) {
      currentAnswer = line.replace(ANSWER_LINE_PATTERN, 'Answer: ').trim()
      continue
    }

    if (currentAnswer) {
      currentAnswer = `${currentAnswer} ${line.trim()}`.trim()
    } else if (line.trim()) {
      currentQuestion = `${currentQuestion} ${line.trim()}`.trim()
    }
  }

  if (currentQuestion || currentAnswer) {
    pushChunk()
  }

  return chunks
}

function splitByLines(text, maxSize) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const chunks = []
  let current = ''
  const pushChunk = () => {
    if (!current) return
    chunks.push(current.trim())
    current = ''
  }

  for (const line of lines) {
    if ((current + ' ' + line).trim().length > maxSize) {
      pushChunk()
    }
    current = `${current} ${line}`.trim()
  }

  if (current.trim()) {
    pushChunk()
  }

  return chunks
}

// Splits text into overlapping chunks while preserving sentences.
// Input: raw document text, options { documentType }
// Output: array of { chunkIndex, chunkText }
export function chunkDocument(text, options = {}) {
  const documentType = String(options.documentType || '').toLowerCase()

  if (['faq', 'troubleshooting'].includes(documentType)) {
    const faqChunks = splitFaqBlocks(text)
    if (faqChunks.length) {
      return faqChunks.map((chunkText, index) => ({ chunkIndex: index, chunkText }))
    }
  }

  if (['formula', 'glossary'].includes(documentType)) {
    const lineChunks = splitByLines(text, Math.max(300, Math.floor(CHUNK_SIZE * 0.6)))
    if (lineChunks.length) {
      return lineChunks.map((chunkText, index) => ({ chunkIndex: index, chunkText }))
    }
  }

  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)

  const chunks = []
  let current = ''

  const pushChunk = () => {
    if (!current) return
    const chunkText = current.trim()
    chunks.push({ chunkIndex: chunks.length, chunkText })
    const overlap = chunkText.slice(Math.max(0, chunkText.length - CHUNK_OVERLAP))
    current = overlap
  }

  sentences.forEach((sentence) => {
    if ((current + ' ' + sentence).trim().length > CHUNK_SIZE) {
      pushChunk()
    }
    current = `${current} ${sentence}`.trim()
  })

  if (current.trim()) {
    pushChunk()
  }

  return chunks
}
