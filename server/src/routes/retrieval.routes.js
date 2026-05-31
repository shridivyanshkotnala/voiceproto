import { Router } from 'express'
import { retrievalSearchController } from '../controllers/retrieval.controller.js'

const router = Router()

// Retrieves RAG context for a given query.
router.post('/search', retrievalSearchController)

export default router
