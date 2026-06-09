import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'
import {
  allocateTokenBudget,
  enforceContextTokenBudget,
  estimateTokens,
} from '../utils/tokenBudget.util.js'
import { rankContextCandidates } from './contextRanking.service.js'

function normalizeSentenceFingerprint(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s=+\-*/().:%]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitSentences(text = '') {
  return String(text || '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function looksLikeFormula(text = '') {
  return /(formula|=|\b(gst|making\s*charges|rate|carat|weight|markup|discount)\b)/i.test(
    text,
  )
}

function looksLikeDefinition(text = '') {
  return /^(definition|define|meaning|what\s+is|gross\s+weight|net\s+weight)[:\s]/i.test(
    text,
  )
}

function looksLikeFaq(text = '') {
  return /(question\s*:|^q\s*[:.-]|answer\s*:|^a\s*[:.-])/i.test(text)
}

function hasExactValue(text = '') {
  return /\b\d+(\.\d+)?\s*(%|gm|g|kg|carat|ct|rs|inr)?\b/i.test(text)
}

function classifyContextBlock(text = '') {
  if (looksLikeFaq(text)) return 'FAQ'
  if (looksLikeFormula(text)) return 'Formula'
  if (looksLikeDefinition(text)) return 'Definition'
  if (/(rule|must|required|policy|should|workflow|process)/i.test(text)) {
    return 'Business Rule'
  }
  return 'Context'
}

function removeDuplicateChunks(candidates = []) {
  const seen = new Set()
  const deduped = []

  for (const candidate of candidates) {
    const text = String(candidate?.chunkText || '').trim()
    if (!text) continue

    const fp = normalizeSentenceFingerprint(text)
    if (!fp || seen.has(fp)) continue

    seen.add(fp)
    deduped.push(candidate)
  }

  return deduped
}

function buildOptimizedBlock(candidate, usedFingerprints) {
  const rawText = String(candidate?.chunkText || '').trim()
  if (!rawText) return ''

  const picked = []
  for (const sentence of splitSentences(rawText)) {
    const fp = normalizeSentenceFingerprint(sentence)
    if (!fp) continue

    const isCritical =
      looksLikeFormula(sentence) ||
      looksLikeDefinition(sentence) ||
      looksLikeFaq(sentence) ||
      hasExactValue(sentence)

    if (usedFingerprints.has(fp) && !isCritical) {
      continue
    }

    if (!usedFingerprints.has(fp)) {
      usedFingerprints.add(fp)
    }

    picked.push(sentence)

    if (picked.length >= RETRIEVAL_CONFIG.OPTIMIZER.MAX_SENTENCES_PER_CHUNK) {
      break
    }
  }

  if (!picked.length) return ''

  const merged = picked.join(' ').trim()
  const section = classifyContextBlock(merged)
  return {
    section,
    text: merged,
  }
}

function buildStructuredContext(blocks = []) {
  const grouped = new Map()

  for (const block of blocks) {
    if (!grouped.has(block.section)) {
      grouped.set(block.section, [])
    }
    grouped.get(block.section).push(block.text)
  }

  const sectionOrder = ['Definition', 'Formula', 'Business Rule', 'FAQ', 'Context']

  return sectionOrder
    .filter((section) => grouped.has(section))
    .map((section) => `[${section}]\n${grouped.get(section).join('\n')}`)
}

function buildCitation(candidate, index) {
  return {
    index,
    documentName: candidate?.documentName || candidate?.metadata?.source || 'unknown',
    documentType: candidate?.metadata?.documentType || 'industry_article',
    chunkIndex: candidate?.chunkIndex ?? null,
  }
}

function compressBlocksToBudget(structuredBlocks, contextBudgetTokens) {
  const firstPass = enforceContextTokenBudget({
    contextBlocks: structuredBlocks,
    budgetTokens: contextBudgetTokens,
  })

  if (!firstPass.trimmed) {
    return firstPass
  }

  const secondPassBlocks = firstPass.contextBlocks.map((block) => {
    const sectionHeader = block.match(/^\[[^\]]+\]/)?.[0] || '[Context]'
    const content = block.replace(/^\[[^\]]+\]\s*/m, '').trim()
    const trimmedContent = content
      .split(/(?<=[.!?])\s+/)
      .slice(0, 2)
      .join(' ')
      .trim()

    return `${sectionHeader}\n${trimmedContent}`
  })

  return enforceContextTokenBudget({
    contextBlocks: secondPassBlocks,
    budgetTokens: contextBudgetTokens,
  })
}

export function optimizeContext({
  candidates = [],
  query,
  queryIntelligence,
  tokenBudget,
}) {
  const deduped = removeDuplicateChunks(candidates)
  const ranking = rankContextCandidates({
    candidates: deduped,
    query,
    queryIntelligence,
    limit: RETRIEVAL_CONFIG.RAG_FINAL_CONTEXT_LIMIT,
  })

  const selected = ranking.selected.slice(0, RETRIEVAL_CONFIG.RAG_FINAL_CONTEXT_LIMIT)
  const usedFingerprints = new Set()

  const reducedBlocks = selected
    .map((candidate) => buildOptimizedBlock(candidate, usedFingerprints))
    .filter(Boolean)

  const structuredBlocks = buildStructuredContext(reducedBlocks)
  const budget = allocateTokenBudget(tokenBudget)

  const compressed = compressBlocksToBudget(structuredBlocks, budget.availableContext)
  const contextText = compressed.contextText

  const citations = selected.map((candidate, index) => buildCitation(candidate, index + 1))
  const sourceChunks = selected.map((candidate) => ({
    documentName: candidate?.documentName || candidate?.metadata?.source || 'unknown',
    documentType: candidate?.metadata?.documentType || 'industry_article',
    chunkIndex: candidate?.chunkIndex ?? null,
    textSnippet: String(candidate?.chunkText || '').slice(0, 500),
    scores: {
      vector: candidate?.vectorScore ?? 0,
      rerank: candidate?.rerankScore ?? candidate?.finalScore ?? 0,
      keyword: candidate?.keywordMatchScore ?? candidate?.keywordScore ?? 0,
      final: candidate?.rankingFinalScore ?? candidate?.finalScore ?? 0,
    },
  }))

  const beforeChars = selected.reduce(
    (sum, item) => sum + String(item?.chunkText || '').length,
    0,
  )
  const afterChars = contextText.length

  return {
    contextText,
    citations,
    sourceChunks,
    rankedCandidates: ranking.ranked,
    selectedCandidates: selected,
    intentRoute: ranking.route,
    stats: {
      inputChunks: candidates.length,
      dedupedChunks: deduped.length,
      rerankedChunks: ranking.ranked.length,
      finalChunks: selected.length,
      contextTokens: estimateTokens(contextText),
      contextChars: afterChars,
      compressionRatio: Number((afterChars / Math.max(1, beforeChars)).toFixed(3)),
      budgetTokens: budget.availableContext,
      budgetExceeded: compressed.trimmed,
    },
  }
}
