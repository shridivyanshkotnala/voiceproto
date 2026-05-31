import fs from 'fs'
import path from 'path'
import multer from 'multer'
import { ApiError } from '../utils/ApiError.js'

// Multer configuration for temporary audio uploads with validation.
// Input: multipart/form-data with `audio` field
// Output: file metadata in req.file
const uploadDir = path.resolve(process.cwd(), 'uploads')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const allowedMimeTypes = new Set([
  'audio/wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/opus',
  'application/ogg',
])

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase()
    cb(null, `${timestamp}-${safeName}`)
  },
})

function fileFilter(req, file, cb) {
  const normalizedMimeType = String(file.mimetype || '')
    .toLowerCase()
    .split(';')[0]
    .trim()

  if (!allowedMimeTypes.has(normalizedMimeType)) {
    return cb(
      new ApiError(
        400,
        'Invalid audio format. Allowed: wav, mp3, webm, mp4/m4a, ogg/opus.',
      ),
    )
  }

  return cb(null, true)
}

export const uploadAudio = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
}).single('audio')
