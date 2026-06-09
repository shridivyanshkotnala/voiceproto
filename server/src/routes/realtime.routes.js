import { Router } from 'express'
import { getRealtimeConfigController } from '../controllers/realtime.controller.js'

const router = Router()

router.get('/config', getRealtimeConfigController)

export default router
