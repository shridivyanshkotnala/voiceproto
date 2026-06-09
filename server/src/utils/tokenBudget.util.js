import { RETRIEVAL_CONFIG } from '../constants/retrieval.constants.js'

const CHARS_PER_TOKEN_HEURISTIC = 4

function safeNumber(value, fallback) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback
}

export function estimateTokens(text = '') {
  const normalized = String(text || '').trim()
  if (!normalized) return 0
  return Math.ceil(normalized.length / CHARS_PER_TOKEN_HEURISTIC)
}

export function allocateTokenBudget({
  totalBudget = RETRIEVAL_CONFIG.TOKEN_BUDGET.total,
  systemPromptBudget = RETRIEVAL_CONFIG.TOKEN_BUDGET.systemPrompt,
  userQueryBudget = RETRIEVAL_CONFIG.TOKEN_BUDGET.userQuery,
  responseBudget = RETRIEVAL_CONFIG.TOKEN_BUDGET.response,
  maxContextBudget = RETRIEVAL_CONFIG.TOKEN_BUDGET.maxContext,
} = {}) {
  const total = safeNumber(totalBudget, RETRIEVAL_CONFIG.TOKEN_BUDGET.total)
  const systemPrompt = safeNumber(
    systemPromptBudget,
    RETRIEVAL_CONFIG.TOKEN_BUDGET.systemPrompt,
  )
  const userQuery = safeNumber(
    userQueryBudget,
    RETRIEVAL_CONFIG.TOKEN_BUDGET.userQuery,
  )
  const response = safeNumber(responseBudget, RETRIEVAL_CONFIG.TOKEN_BUDGET.response)
  const maxContext = safeNumber(
    maxContextBudget,
    RETRIEVAL_CONFIG.TOKEN_BUDGET.maxContext,
  )

  const reserved = Math.max(0, systemPrompt) + Math.max(0, userQuery) + Math.max(0, response)
  const available = Math.max(0, total - reserved)

  return {
    total,
    systemPrompt,
    userQuery,
    response,
    maxContext,
    availableContext: Math.max(0, Math.min(available, maxContext)),
  }
}

export function enforceContextTokenBudget({ contextBlocks = [], budgetTokens }) {
  const budget = Math.max(0, safeNumber(budgetTokens, 0))
  if (!budget) {
    return {
      contextBlocks: [],
      contextText: '',
      contextTokens: 0,
      trimmed: contextBlocks.length > 0,
    }
  }

  const kept = []
  let used = 0

  for (const block of contextBlocks) {
    const blockText = String(block || '').trim()
    if (!blockText) continue

    const blockTokens = estimateTokens(blockText)
    if (used + blockTokens <= budget) {
      kept.push(blockText)
      used += blockTokens
      continue
    }

    const remaining = budget - used
    if (remaining <= 0) break

    const roughChars = Math.max(0, remaining * CHARS_PER_TOKEN_HEURISTIC)
    const trimmedText = blockText.slice(0, roughChars).trim()
    if (trimmedText) {
      kept.push(trimmedText)
      used += estimateTokens(trimmedText)
    }
    break
  }

  return {
    contextBlocks: kept,
    contextText: kept.join('\n\n').trim(),
    contextTokens: used,
    trimmed: kept.length < contextBlocks.filter(Boolean).length,
  }
}
