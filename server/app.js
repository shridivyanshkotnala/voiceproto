import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import voiceRoutes from './src/routes/voice.routes.js'
import languageRoutes from './src/routes/language.routes.js'
import knowledgeRoutes from './src/routes/knowledge.routes.js'
import retrievalRoutes from './src/routes/retrieval.routes.js'
import responseRoutes from './src/routes/response.routes.js'
import pronunciationRoutes from './src/routes/pronunciation.routes.js'
import realtimeRoutes from './src/routes/realtime.routes.js'
import { ApiError } from './src/utils/ApiError.js'

const app = express()

app.set('trust proxy', 1)

const configuredOrigins = String(process.env.FRONTEND_URL || '')
	.split(',')
	.map((value) => value.trim())
	.filter(Boolean)

const allowList = new Set([
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	...configuredOrigins,
])

function isAllowedOrigin(origin) {
	if (!origin) return true
	if (allowList.has(origin)) return true

	try {
		const { hostname } = new URL(origin)
		return hostname.endsWith('.vercel.app')
	} catch {
		return false
	}
}

// Normalizes repeated slashes so client typos like //api/... still reach routes.
app.use((req, res, next) => {
	const [pathname, query = ''] = req.url.split('?')
	const normalizedPath = pathname.replace(/\/{2,}/g, '/')

	if (normalizedPath !== pathname) {
		console.warn(
			`[url-normalized] ${req.method} ${pathname} -> ${normalizedPath}`,
		)
		req.url = query ? `${normalizedPath}?${query}` : normalizedPath
	}

	next()
})

// Allows frontend to call the voice transcription API securely.
// Input: FRONTEND_URL env
// Output: CORS-enabled API responses.
app.use(
	cors({
		origin: (origin, callback) => {
			if (isAllowedOrigin(origin)) {
				return callback(null, true)
			}

			return callback(new Error(`CORS blocked for origin: ${origin}`))
		},
		credentials: true,
		methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
		allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
	}),
)

app.use(cookieParser())

app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }))
app.use(express.urlencoded({ extended: true }))

// Attach request ID for traceability.
app.use((req, res, next) => {
	req.requestId = crypto.randomUUID()
	res.setHeader('x-request-id', req.requestId)
	next()
})

// Basic structured request logging with latency.
app.use((req, res, next) => {
	const startedAt = Date.now()
	res.on('finish', () => {
		const durationMs = Date.now() - startedAt
		console.info('[request]', {
			requestId: req.requestId,
			method: req.method,
			path: req.originalUrl,
			statusCode: res.statusCode,
			durationMs,
		})
	})
	next()
})

const generalLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: Number(process.env.RATE_LIMIT_PER_MINUTE || 120),
	standardHeaders: true,
	legacyHeaders: false,
})

const voiceLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: Number(process.env.RATE_LIMIT_VOICE_PER_MINUTE || 30),
	standardHeaders: true,
	legacyHeaders: false,
})

// Health check endpoint for deployment readiness.
app.get('/health', (req, res) => {
	res.status(200).json({ status: 'ok' })
})

app.use('/api/v1/voice', voiceLimiter, voiceRoutes)
app.use('/api/v1/language', languageRoutes)
app.use('/api/v1/knowledge', knowledgeRoutes)
app.use('/api/v1/retrieval', retrievalRoutes)
app.use('/api/v1/response', generalLimiter, responseRoutes)
app.use('/api/v1/pronunciation', pronunciationRoutes)
app.use('/api/v1/optimization', pronunciationRoutes)
app.use('/api/v1/realtime', realtimeRoutes)

app.use((req, res, next) => {
	console.warn(`[404] ${req.method} ${req.originalUrl}`)
	next(new ApiError(404, 'Route not found'))
})

// Centralized error handler for API consistency.
app.use((error, req, res, next) => {
	if (error?.name === 'MulterError') {
		const message =
			error.code === 'LIMIT_FILE_SIZE'
				? 'Audio file exceeds 20MB limit.'
				: error.message
		const statusCode = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
		return res.status(statusCode).json({ success: false, message })
	}

	const statusCode = error.statusCode || 500
	const message = error.message || 'Internal server error'
	console.error(`[${statusCode}] ${req.method} ${req.originalUrl} - ${message}`)

	return res.status(statusCode).json({
		success: false,
		message,
	})
})

export default app
