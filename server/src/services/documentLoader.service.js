import fs from 'fs/promises'
import path from 'path'
import { ApiError } from '../utils/ApiError.js'

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
    documentType: 'txt',
    fileSize: file.size,
  }
}
