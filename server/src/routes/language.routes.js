import { Router } from 'express'
import { analyzeLanguageController } from '../controllers/language.controller.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getUsageSummaryController } from '../controllers/usage.controller.js'

const router = Router()

// Receives message and returns language intelligence profile.
router.post('/analyze', asyncHandler(analyzeLanguageController))
router.get('/usage/summary', asyncHandler(getUsageSummaryController))

export default router
