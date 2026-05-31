import {
  BUSINESS_WORD_WHITELIST,
  CARAT_PATTERN,
  HINDI_WORD_MAP,
  MATH_OPERATOR_MAP,
  NAME_MAP,
  PROPER_NOUN_WHITELIST,
} from '../constants/pronunciation.constants.js'

const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]

const TENS = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]

function numberToWords(value) {
  if (value < 20) return ONES[value]
  if (value < 100) {
    const tens = Math.floor(value / 10)
    const rest = value % 10
    return rest ? `${TENS[tens]} ${ONES[rest]}` : TENS[tens]
  }
  if (value < 1000) {
    const hundreds = Math.floor(value / 100)
    const rest = value % 100
    return rest
      ? `${ONES[hundreds]} hundred ${numberToWords(rest)}`
      : `${ONES[hundreds]} hundred`
  }
  if (value < 1000000) {
    const thousands = Math.floor(value / 1000)
    const rest = value % 1000
    return rest
      ? `${numberToWords(thousands)} thousand ${numberToWords(rest)}`
      : `${numberToWords(thousands)} thousand`
  }
  return String(value)
}

function splitToken(token) {
  const match = token.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}\.]+)([^\p{L}\p{N}]*)$/u)
  if (!match) {
    return { leading: '', core: token, trailing: '' }
  }

  return {
    leading: match[1] || '',
    core: match[2] || '',
    trailing: match[3] || '',
  }
}

function isWhitelisted(coreLower) {
  return (
    BUSINESS_WORD_WHITELIST.has(coreLower) ||
    PROPER_NOUN_WHITELIST.has(coreLower)
  )
}

function replaceCarat(core) {
  const match = core.match(CARAT_PATTERN)
  if (!match) return { text: core, wasCarat: false }
  return { text: `${match[1]} Carat`, wasCarat: true }
}

function replaceNumber(core) {
  if (!/^\d+$/.test(core)) return core
  const value = Number(core)
  if (Number.isNaN(value)) return core
  return numberToWords(value)
}

function replaceOperator(core) {
  if (MATH_OPERATOR_MAP[core]) {
    return MATH_OPERATOR_MAP[core]
  }
  return core
}

function replaceName(core) {
  const mapped = NAME_MAP[core.toLowerCase()]
  return mapped || core
}

function replaceHindiWord(core) {
  const mapped = HINDI_WORD_MAP[core.toLowerCase()]
  return mapped || core
}

export function optimizeTokens({ text, language }) {
  const tokens = text.match(/\s+|\S+/g) || []

  return tokens
    .map((token) => {
      if (/^\s+$/.test(token)) return token

      const { leading, core, trailing } = splitToken(token)
      if (!core) return token

      const coreLower = core.toLowerCase()
      if (isWhitelisted(coreLower)) {
        return `${leading}${core}${trailing}`
      }

      let nextCore = core

      nextCore = replaceOperator(nextCore)
      const caratResult = replaceCarat(nextCore)
      nextCore = caratResult.text

      if (/\s/.test(nextCore)) {
        if (caratResult.wasCarat) {
          return `${leading}${nextCore}${trailing}`
        }

        const parts = nextCore.split(/\s+/)
        const processed = parts.map((part) => replaceNumber(part))
        return `${leading}${processed.join(' ')}${trailing}`
      }

      if (!caratResult.wasCarat) {
        nextCore = replaceNumber(nextCore)
      }

      if (language === 'hinglish') {
        nextCore = replaceName(nextCore)
        nextCore = replaceHindiWord(nextCore)
      } else {
        nextCore = replaceName(nextCore)
      }

      return `${leading}${nextCore}${trailing}`
    })
    .join('')
}