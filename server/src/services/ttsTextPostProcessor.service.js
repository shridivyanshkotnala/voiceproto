const OPERATOR_MAP = new Map([
  ['+', ' plus '],
  ['-', ' minus '],
  ['*', ' multiply by '],
  ['×', ' multiply by '],
  ['/', ' divided by '],
  ['=', ' equals '],
])

const CARAT_REGEX = /\b(\d{1,2})\s*[kK]\b/g
const DIGIT_REGEX = /\b\d+\b/g

function clampNumber(value, max) {
  return value > max ? max : value
}

function numberToWords(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)

  const normalized = Math.trunc(number)
  if (normalized < 0) return `minus ${numberToWords(Math.abs(normalized))}`
  if (normalized === 0) return 'zero'

  const ones = [
    '',
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
  const tens = [
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

  function underThousand(n) {
    const hundred = Math.floor(n / 100)
    const remainder = n % 100
    const parts = []

    if (hundred) {
      parts.push(`${ones[hundred]} hundred`)
    }

    if (remainder) {
      if (remainder < 20) {
        parts.push(ones[remainder])
      } else {
        const ten = Math.floor(remainder / 10)
        const unit = remainder % 10
        parts.push(tens[ten])
        if (unit) {
          parts.push(ones[unit])
        }
      }
    }

    return parts.join(' ')
  }

  if (normalized < 1000) {
    return underThousand(normalized)
  }

  const thousands = Math.floor(normalized / 1000)
  const remainder = normalized % 1000
  const parts = [`${underThousand(thousands)} thousand`]
  if (remainder) {
    parts.push(underThousand(remainder))
  }

  return parts.join(' ')
}

function normalizeOperators(text) {
  let normalized = text
  for (const [operator, replacement] of OPERATOR_MAP.entries()) {
    const escaped = operator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    normalized = normalized.replace(
      new RegExp(`\\s*${escaped}\\s*`, 'g'),
      replacement,
    )
  }
  normalized = normalized.replace(/\b[xX]\b/g, ' multiply by ')
  return normalized.replace(/\s{2,}/g, ' ').trim()
}

function replaceCarats(text) {
  return text.replace(CARAT_REGEX, (_, carat) => `${carat} Carat`)
}

function replaceDigits(text, maxDigits = 5) {
  return text.replace(DIGIT_REGEX, (match) => {
    if (match.length > maxDigits) {
      return match
    }
    const limited = clampNumber(Number(match), 99999)
    return numberToWords(limited)
  })
}

export function postProcessTtsText(rawText = '') {
  const trimmed = String(rawText || '').trim()
  if (!trimmed) return ''

  const withCarats = replaceCarats(trimmed)
  const withOperators = normalizeOperators(withCarats)
  const withNumbers = replaceDigits(withOperators)

  return withNumbers.replace(/\s{2,}/g, ' ').trim()
}
