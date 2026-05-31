import { Router } from 'express'
import { generateResponseController } from '../controllers/response.controller.js'

const router = Router()

// Generates final response using retrieval + language preservation.
router.post('/generate', generateResponseController)

export default router
