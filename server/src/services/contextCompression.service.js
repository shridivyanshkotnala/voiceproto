import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function scoreSentence(sentence, queryTokens) {
  if (!sentence) return 0
  const tokens = new Set(tokenize(sentence))
  let score = 0
  queryTokens.forEach((token) => {
    if (tokens.has(token)) score += 1
  })
  return score
}

function extractFaqEntry(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return null

  const qLine = lines.find((line) => /^question\s*:/i.test(line) || /^q\s*[:.-]/i.test(line))
  const aLine = lines.find((line) => /^answer\s*:/i.test(line) || /^a\s*[:.-]/i.test(line))

  if (!qLine && !aLine) return null
  return [qLine, aLine].filter(Boolean).join(' ')
}

function extractRelevantSentences(text, queryTokens, limit) {
  const faqEntry = extractFaqEntry(text)
  if (faqEntry) {
    return [faqEntry]
  }

  const sentences = String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const ranked = sentences
    .map((sentence) => ({
      sentence,
      score: scoreSentence(sentence, queryTokens),
    }))
    .sort((a, b) => b.score - a.score)

  const selected = ranked
    .filter((item) => item.score > 0)
    .slice(0, limit)
    .map((item) => item.sentence)

  if (selected.length) {
    return selected
  }

  return sentences.slice(0, Math.max(1, limit))
}

function buildCitation(candidate, index) {
  return {
    index,
    documentName: candidate?.documentName || candidate?.metadata?.source || 'unknown',
    documentType: candidate?.metadata?.documentType || 'industry_article',
    chunkIndex: candidate?.chunkIndex ?? null,
  }
}

// Compresses context by extracting top sentences per candidate.
// Input: { candidates, query }
// Output: { contextText, citations, sourceChunks, stats }
export function compressContext({ candidates = [], query }) {
  const queryTokens = tokenize(query)
  const maxSentences = RETRIEVAL_CONFIG.CONTEXT_MAX_SENTENCES
  const maxChars = RETRIEVAL_CONFIG.CONTEXT_MAX_CHARS

  const contextBlocks = []
  const citations = []
  const sourceChunks = []

  let sentenceBudget = maxSentences
  for (const [index, candidate] of candidates.entries()) {
    if (sentenceBudget <= 0) break

    const sentences = extractRelevantSentences(
      candidate?.chunkText || '',
      queryTokens,
      Math.max(1, Math.ceil(sentenceBudget / 2)),
    )

    if (!sentences.length) continue
    const block = `[Chunk ${index + 1}]\n${sentences.join(' ')}
`
    contextBlocks.push(block)
    citations.push(buildCitation(candidate, index + 1))
    sourceChunks.push({
      documentName: candidate?.documentName || candidate?.metadata?.source || 'unknown',
      documentType: candidate?.metadata?.documentType || 'industry_article',
      chunkIndex: candidate?.chunkIndex ?? null,
      textSnippet: sentences.join(' '),
      scores: {
        semantic: candidate?.semanticScore ?? candidate?.score ?? 0,
        keyword: candidate?.keywordScore ?? 0,
        domain: candidate?.domainScore ?? 0,
        final: candidate?.finalScore ?? 0,
      },
    })

    sentenceBudget -= sentences.length
  }

  let contextText = contextBlocks.join('\n')
  if (maxChars > 0 && contextText.length > maxChars) {
    contextText = contextText.slice(0, maxChars)
  }

  return {
    contextText: contextText.trim(),
    citations,
    sourceChunks,
    stats: {
      chunksUsed: sourceChunks.length,
      sentencesUsed: Math.max(0, maxSentences - sentenceBudget),
      contextChars: contextText.length,
      compressionRatio: Number(
        (
          (sourceChunks.reduce((sum, chunk) => sum + String(chunk.textSnippet || '').length, 0) || 1) /
          Math.max(1, candidates.reduce((sum, item) => sum + String(item?.chunkText || '').length, 0))
        ).toFixed(3),
      ),
    },
  }
}
