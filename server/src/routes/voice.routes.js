import { Router } from 'express'
import {
	synthesizeVoiceController,
	transcribeAudioController,
} from '../controllers/voice.controller.js'
import { uploadAudio } from '../middlewares/upload.middleware.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Route flow: multipart upload -> multer validation -> controller -> STT service.
router.post('/transcribe', uploadAudio, asyncHandler(transcribeAudioController))

// Route flow: JSON request -> controller -> ElevenLabs TTS streaming.
router.post('/synthesize', asyncHandler(synthesizeVoiceController))

export default router
