import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import {
  uploadKnowledgeController,
  searchKnowledgeController,
  getKnowledgeStatsController,
} from '../controllers/knowledge.controller.js'
import { KNOWLEDGE_UPLOAD_DIR } from '../constants/rag.constants.js'

const router = Router()

const uploadDir = path.resolve(process.cwd(), KNOWLEDGE_UPLOAD_DIR)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase()
    cb(null, `${timestamp}-${safeName}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('file')

// Uploads knowledge document for ingestion.
router.post('/upload', upload, uploadKnowledgeController)

// Searches knowledge base using semantic search.
router.post('/search', searchKnowledgeController)

// Returns stats for admin analytics.
router.get('/stats', getKnowledgeStatsController)

export default router
