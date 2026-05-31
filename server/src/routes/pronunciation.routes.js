import { Router } from 'express'
import { optimizePronunciationController } from '../controllers/pronunciation.controller.js'

const router = Router()

// Optimizes response text for TTS pronunciation.
router.post('/optimize', optimizePronunciationController)
router.post('/', optimizePronunciationController)

export default router
