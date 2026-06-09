const STOPWORDS = new Set([
  'hai', 'hain', 'tha', 'thi', 'the', 'kya', 'kaise', 'kaisa', 'kaun', 'kab', 'kyun', 'kyo',
  'kis', 'kisi', 'ke', 'ka', 'ki', 'me', 'mein', 'se', 'par', 'pe', 'aur', 'ya', 'to', 'us',
  'usme', 'uske', 'iske', 'iska', 'iski', 'that', 'this', 'there', 'here', 'please', 'plz',
  'sir', 'madam', 'ji', 'bhai', 'bro', 'pls', 'tell', 'batao', 'bataye', 'batana', 'kar',
  'karo', 'karne', 'karna', 'karni', 'acha', 'achha', 'haan', 'haanji', 'jii', 'mam', 'maam',
])

const STT_NOISE_PATTERNS = [
  /\b(?:hmm+|uh+|um+|aa+|huh+)\b/gi,
  /\b(?:please please|sir sir|mam mam|maam maam)\b/gi,
  /\b(?:like maam|achha ma'am|acha maam)\b/gi,
]

const TYPO_NORMALIZATION = new Map([
  ['kaireta', 'carat'],
  ['kareta', 'carat'],
  ['caret', 'carat'],
  ['bar code', 'barcode'],
  ['q r', 'qr'],
  ['wrok', 'work'],
  ['scnner', 'scanner'],
  ['inventry', 'inventory'],
  ['reprt', 'report'],
  ['opreation', 'operation'],
  ['calcualtion', 'calculation'],
  ['trubleshoot', 'troubleshoot'],
])

const ABBREVIATIONS = new Map([
  ['tts', 'text to speech'],
  ['stt', 'speech to text'],
  ['kb', 'knowledge base'],
  ['ocr', 'optical character recognition'],
  ['mcx', 'multi commodity exchange live gold rate'],
  ['qr', 'quick response code'],
  ['2fa', 'two factor authentication'],
])

const PHRASE_NORMALIZATION = [
  { from: /tts\s+delay\s+kyu\s+hai/gi, to: 'why is text to speech generation delayed' },
  { from: /14k\s+calculation\s+hoga/gi, to: 'does system support 14k gold calculation' },
  { from: /scanner\s+text\s+bhi\s+scan\s+karega/gi, to: 'can scanner read text without qr code or barcode' },
  { from: /barcode\s+ke\s+bina\s+scan\s+karega/gi, to: 'can scanner read text without qr code or barcode' },
  { from: /hisaab/gi, to: 'calculation' },
  { from: /maal/gi, to: 'inventory item stock' },
  { from: /nahi\s+chal\s+raha|nahi\s+chal\s+rahi|kam\s+nahi\s+kar\s+raha|work\s+nahi\s+kar\s+raha/gi, to: 'not working issue' },
  { from: /scan\s+kar(ne|na|ta|ti)?/gi, to: 'scan' },
  { from: /gold\s+rate|sona\s+rate|sone\s+ka\s+rate/gi, to: 'gold pricing rate' },
  { from: /14\s*k|18\s*k|22\s*k|24\s*k/gi, to: (match) => match.replace(/\s+/g, '') },
]

const HINGLISH_DICTIONARY = {
  hisaab: ['calculation', 'formula', 'pricing computation'],
  rate: ['pricing', 'valuation', 'gold rate'],
  scanner: ['scanner', 'barcode', 'qr', 'text recognition', 'ocr'],
  maal: ['inventory', 'stock item'],
  report: ['report', 'analytics', 'summary'],
  formula: ['formula', 'calculation equation'],
  delay: ['latency', 'slow response'],
  setting: ['configuration', 'setup'],
}

const DOMAIN_KEYWORDS = {
  pricing: ['pricing', 'price', 'rate', 'valuation', 'gold', 'carat', 'purity', 'mcx', 'discount', 'margin'],
  formula: ['formula', 'calculation', 'equation', 'compute', 'making charges', 'gst', '14k', '18k', '22k', '24k'],
  scanner: ['scanner', 'barcode', 'qr', 'scan', 'ocr', 'tag'],
  inventory: ['inventory', 'stock', 'ledger', 'reconciliation', 'opening', 'closing', 'maal'],
  reports: ['report', 'dashboard', 'analytics', 'summary', 'export', 'audit report'],
  operations: ['operations', 'workflow', 'process', 'pipeline', 'orchestration'],
  troubleshooting: ['troubleshoot', 'issue', 'problem', 'error', 'not working', 'fail', 'delay', 'stuck', 'timeout'],
  security: ['security', 'auth', 'permission', 'role', 'access', 'token', '2fa', 'encryption'],
  users: ['user', 'staff', 'account', 'login', 'employee', 'customer'],
  system: ['system', 'service', 'server', 'api', 'configuration', 'setup'],
}

const INTENT_KEYWORDS = {
  formula_lookup: ['formula', 'calculation', 'equation', 'compute', '14k', '18k', '22k', '24k', 'mcx'],
  feature_check: ['support', 'can', 'able', 'handle', 'possible', 'karega'],
  troubleshooting: ['issue', 'problem', 'error', 'fail', 'not working', 'delay', 'stuck', 'kyu'],
  workflow: ['workflow', 'process', 'steps', 'flow', 'kaise'],
  configuration: ['configure', 'setting', 'setup', 'enable', 'disable'],
  reporting: ['report', 'dashboard', 'analytics', 'summary', 'export'],
  question: ['what', 'why', 'how', 'kya', 'kyu', 'kaise'],
}

const QUERY_EXPANSIONS = {
  scanner: ['scanner issue', 'barcode scanning issue', 'scanner troubleshooting', 'barcode scanner not working', 'text recognition without barcode'],
  inventory: ['inventory issue', 'stock update', 'inventory tracking', 'stock reconciliation', 'inventory workflow'],
  pricing: ['pricing rules', 'pricing calculation', 'price calculation', 'margin calculation', 'gold valuation'],
  formula: ['formula lookup', 'calculation steps', 'rate calculation', 'pricing formula', 'making charges formula', 'gold purity formula'],
  reports: ['report generation', 'report export', 'analytics dashboard'],
  operations: ['operations workflow', 'system operation process'],
  troubleshooting: ['troubleshooting', 'issue resolution', 'error fix', 'diagnostic steps'],
  security: ['access control', 'permission issue', 'authentication configuration'],
  users: ['user management', 'account setup', 'staff access'],
  system: ['system configuration', 'service setup', 'api integration'],
}

function normalizeWhitespace(text = '') {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function applyTypos(text = '') {
  let output = text
  for (const [wrong, correct] of TYPO_NORMALIZATION.entries()) {
    output = output.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct)
  }
  return output
}

function applyAbbreviations(text = '') {
  let output = text
  for (const [shortForm, expanded] of ABBREVIATIONS.entries()) {
    output = output.replace(new RegExp(`\\b${shortForm}\\b`, 'gi'), expanded)
  }
  return output
}

function applyPhraseNormalization(text = '') {
  let output = text
  for (const rule of PHRASE_NORMALIZATION) {
    output = output.replace(rule.from, rule.to)
  }
  return output
}

function cleanupSttNoise(text = '') {
  let output = text
  for (const pattern of STT_NOISE_PATTERNS) {
    output = output.replace(pattern, ' ')
  }
  return output
}

function normalizeText(text = '') {
  let normalized = String(text || '').toLowerCase().trim()
  normalized = cleanupSttNoise(normalized)
  normalized = applyTypos(normalized)
  normalized = applyAbbreviations(normalized)
  normalized = applyPhraseNormalization(normalized)
  normalized = normalized.replace(/[^a-z0-9\s]/gi, ' ')
  normalized = normalizeWhitespace(normalized)
  normalized = normalized.replace(/\bgold\s+calculation\b/gi, 'gold pricing calculation')
  normalized = normalized.replace(/\b(reporting)\b/gi, 'report')
  return normalizeWhitespace(normalized)
}

function extractKeywords(text = '') {
  return normalizeText(text)
    .split(' ')
    .filter((token) => token && !STOPWORDS.has(token))
}

function scoreByKeywords(text = '', table = {}) {
  const scores = new Map()
  const normalized = ` ${text} `
  Object.entries(table).forEach(([label, keywords]) => {
    let score = 0
    for (const keyword of keywords) {
      const safe = String(keyword || '').trim()
      if (!safe) continue
      if (safe.includes(' ')) {
        if (normalized.includes(` ${safe} `)) score += 2
      } else if (new RegExp(`\\b${safe}\\b`, 'i').test(normalized)) {
        score += 1
      }
    }
    scores.set(label, score)
  })
  return scores
}

function selectTopLabel(scoreMap, fallback = 'general') {
  let selected = fallback
  let best = -1
  for (const [label, score] of scoreMap.entries()) {
    if (score > best) {
      best = score
      selected = label
    }
  }
  return best <= 0 ? fallback : selected
}

function detectDomain(text) {
  const normalized = String(text || '').toLowerCase()

  if (/\b(scanner|barcode|qr|scan|ocr|tag)\b/.test(normalized)) {
    return 'scanner'
  }
  if (/\b(inventory|stock|ledger|reconciliation|opening|closing|maal)\b/.test(normalized)) {
    return 'inventory'
  }
  if (/\b(report|dashboard|analytics|summary|audit report|export)\b/.test(normalized)) {
    return 'reports'
  }
  if (/\b(formula|calculation|equation|14k|18k|22k|24k|carat|purity|mcx|pricing|rate|valuation)\b/.test(normalized)) {
    return /\b(formula|equation|calculation)\b/.test(normalized) ? 'formula' : 'pricing'
  }
  if (/\b(user|account|staff|employee|customer|login)\b/.test(normalized)) {
    return 'users'
  }
  if (/\b(security|auth|authentication|permission|role|access|token|2fa|encryption)\b/.test(normalized)) {
    return 'security'
  }
  if (/\b(system|service|server|api|configuration|setup)\b/.test(normalized)) {
    return 'system'
  }

  const scores = scoreByKeywords(normalized, DOMAIN_KEYWORDS)
  return selectTopLabel(scores, 'system')
}

function detectIntent(text) {
  const normalized = String(text || '').toLowerCase()

  if (/\b(formula|calculation|equation|compute|14k|18k|22k|24k|mcx)\b/.test(normalized)) {
    return 'formula_lookup'
  }
  if (/\b(report|dashboard|analytics|summary|export|audit report)\b/.test(normalized)) {
    return 'reporting'
  }
  if (/\b(configure|configuration|setting|setup|enable|disable)\b/.test(normalized)) {
    return 'configuration'
  }
  if (/\b(issue|problem|error|fail|not working|delay|stuck|timeout|resolve|fix)\b/.test(normalized)) {
    return 'troubleshooting'
  }
  if (/\b(workflow|process|flow|steps|pipeline)\b/.test(normalized)) {
    return 'workflow'
  }
  if (/\b(support|can|able|possible|karega)\b/.test(normalized)) {
    return 'feature_check'
  }

  const scores = scoreByKeywords(normalized, INTENT_KEYWORDS)
  return selectTopLabel(scores, 'question')
}

function mapIntentToLegacyQueryType({ domain, intent }) {
  if (['pricing', 'formula', 'scanner', 'inventory', 'troubleshooting', 'reports'].includes(domain)) {
    return domain === 'reports' ? 'faq' : domain
  }

  if (intent === 'formula_lookup') return 'formula'
  if (intent === 'troubleshooting') return 'troubleshooting'
  if (intent === 'reporting') return 'faq'
  return 'general'
}

function isFollowUpQuery(text) {
  return /^(us|usme|uske|iske|wo|woh|that|this|it|waha|yaha)/i.test(text.trim())
}

function inferFollowUpAnchor(conversationHistory = []) {
  const lastUser = conversationHistory
    .slice()
    .reverse()
    .find((entry) => String(entry?.role || '').toLowerCase() === 'user')

  if (!lastUser?.content) return ''

  const keywords = extractKeywords(lastUser.content)
  return keywords.slice(0, 4).join(' ')
}

function buildSemanticExpansions(normalizedQuery = '') {
  const expansions = new Set()
  const keywords = extractKeywords(normalizedQuery)

  keywords.forEach((keyword) => {
    if (HINGLISH_DICTIONARY[keyword]) {
      HINGLISH_DICTIONARY[keyword].forEach((item) => expansions.add(item))
    }
  })

  if (/14k|18k|22k|24k/.test(normalizedQuery)) {
    expansions.add('gold purity calculation')
    expansions.add('carat wise pricing formula')
  }

  if (/text to speech|speech to text/.test(normalizedQuery)) {
    expansions.add('voice pipeline operations troubleshooting')
  }

  if (/barcode|qr|scan|scanner/.test(normalizedQuery)) {
    expansions.add('scanner text recognition without barcode')
    expansions.add('ocr based tag scanning')
  }

  return Array.from(expansions)
}

function buildExpandedQueries({ normalizedQuery, domain, queryType, intent, semanticExpansions, conversationHistory }) {
  const expansions = new Set()
  if (normalizedQuery) {
    expansions.add(normalizedQuery)
  }

  if (QUERY_EXPANSIONS[domain]) {
    QUERY_EXPANSIONS[domain].forEach((item) => expansions.add(item))
  }

  if (QUERY_EXPANSIONS[queryType]) {
    QUERY_EXPANSIONS[queryType].forEach((item) => expansions.add(item))
  }

  if (QUERY_EXPANSIONS[intent]) {
    QUERY_EXPANSIONS[intent].forEach((item) => expansions.add(item))
  }

  ;(semanticExpansions || []).forEach((item) => expansions.add(item))

  if (/14k|18k|22k|24k/.test(normalizedQuery)) {
    expansions.add('does system support gold purity formula calculation')
    expansions.add('gold purity pricing formula with making charges')
  }

  if (/text to speech/.test(normalizedQuery)) {
    expansions.add('why is text to speech generation delayed')
  }

  if (Array.isArray(conversationHistory) && conversationHistory.length) {
    const lastUser = conversationHistory
      .slice()
      .reverse()
      .find((entry) => String(entry?.role || '').toLowerCase() === 'user')
    const lastContent = lastUser?.content || ''
    const keywords = extractKeywords(lastContent)
    if (keywords.length) {
      expansions.add(`${normalizedQuery} ${keywords.slice(0, 6).join(' ')}`.trim())
    }
  }

  return Array.from(expansions)
}

// Query intelligence: intent/type/domain detection, normalization, expansion.
// Input: { query, conversationHistory }
// Output: { queryType, domain, normalizedQuery, expandedQueries, isFollowUp }
export function analyzeQueryIntelligence({ query, conversationHistory }) {
  const cleanedQuery = normalizeWhitespace(String(query || '').trim())
  const normalizedQuery = normalizeText(cleanedQuery)
  const domain = detectDomain(normalizedQuery)
  const intent = detectIntent(normalizedQuery)
  const queryType = mapIntentToLegacyQueryType({ domain, intent })
  const followUp = isFollowUpQuery(cleanedQuery)
  const followUpAnchor = followUp ? inferFollowUpAnchor(conversationHistory) : ''
  const semanticExpansions = buildSemanticExpansions(normalizedQuery)

  const normalizedWithAnchor = followUpAnchor
    ? `${normalizedQuery} ${followUpAnchor}`.trim()
    : normalizedQuery

  const expandedQueries = buildExpandedQueries({
    normalizedQuery: normalizedWithAnchor,
    domain,
    queryType,
    intent,
    semanticExpansions,
    conversationHistory: followUp ? conversationHistory : null,
  })

  return {
    originalQuery: cleanedQuery,
    cleanedQuery,
    queryType,
    intent,
    domain,
    normalizedQuery: normalizedWithAnchor || cleanedQuery,
    normalizedTokens: extractKeywords(normalizedWithAnchor || cleanedQuery),
    expandedQueries,
    semanticExpansions,
    isFollowUp: followUp,
    followUpAnchor,
    signals: {
      hasCarat: /14k|18k|22k|24k|carat|purity/.test(normalizedWithAnchor),
      hasFormula: /formula|calculation|equation|compute/.test(normalizedWithAnchor),
      hasTroubleshooting: /issue|error|problem|delay|stuck|not working/.test(normalizedWithAnchor),
      hasReportIntent: /report|dashboard|summary|analytics|export/.test(normalizedWithAnchor),
    },
  }
}
