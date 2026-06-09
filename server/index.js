import './loadEnv.js'
import http from 'http'
import { Server } from 'socket.io'
import app from './app.js'
import { connectDB } from './src/config/db.js'
import { registerSignalingServer } from './src/socket/signaling.socket.js'

const PORT = process.env.PORT || 8000

async function startServer() {
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
    },
  })

  registerSignalingServer(io)

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })

  connectDB().catch((error) => {
    console.error(
      'MongoDB connection failed. Running in degraded mode:',
      error?.message || error,
    )
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
