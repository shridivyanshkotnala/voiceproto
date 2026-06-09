import fs from 'fs/promises'
import path from 'path'
import { ApiError } from '../utils/ApiError.js'

const DOCUMENT_TYPE_MAP = [
  { type: 'faq', match: /(faq|frequently asked)/i },
  { type: 'troubleshooting', match: /(troubleshoot|issue|problem|error|debug)/i },
  { type: 'formula', match: /(formula|calculation|calc|rate|pricing formula)/i },
  { type: 'glossary', match: /(glossary|terms|definitions)/i },
  { type: 'inventory', match: /(inventory|stock|ledger)/i },
  { type: 'scanner', match: /(scanner|barcode|qr)/i },
  { type: 'pricing', match: /(pricing|price|margin|markup)/i },
  { type: 'hallmarking', match: /(hallmark|assay|certification)/i },
]

function inferDocumentType(fileName) {
  const normalized = String(fileName || '').toLowerCase()
  for (const rule of DOCUMENT_TYPE_MAP) {
    if (rule.match.test(normalized)) {
      return rule.type
    }
  }
  return 'industry_article'
}

function inferDocumentTypeFromContent(content) {
  const sample = String(content || '').slice(0, 3000)
  if (!sample) return null

  if (/^\s*(q\.?|question)\s*[:.-]/im.test(sample)) return 'faq'
  if (/^\s*(step\s*\d+|error\s*[:.-]|resolution\s*[:.-])/im.test(sample)) return 'troubleshooting'
  if (/\b(formula|equation|=|multiply by|divided by|rate)\b/i.test(sample)) return 'formula'
  if (/^\s*([a-z][a-z\s]+)\s*[:.-]\s+[a-z]/im.test(sample)) return 'glossary'
  return null
}

// Loads and validates knowledge document content.
// Input: file object from multer
// Output: { content, documentName, documentType, fileSize }
export async function loadDocument(file) {
  if (!file) {
    throw new ApiError(400, 'Knowledge file is required')
  }

  const extension = path.extname(file.originalname).toLowerCase()
  if (extension !== '.txt') {
    throw new ApiError(400, 'Only .txt documents are supported currently')
  }

  const content = await fs.readFile(file.path, 'utf-8')
  if (!content.trim()) {
    throw new ApiError(400, 'Knowledge document is empty')
  }

  return {
    content,
    documentName: file.originalname,
    documentType: inferDocumentTypeFromContent(content) || inferDocumentType(file.originalname),
    fileSize: file.size,
  }
}
