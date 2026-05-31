import './loadEnv.js'
import app from './app.js'
import { connectDB } from './src/config/db.js'

const PORT = process.env.PORT || 8000

async function startServer() {
  app.listen(PORT, () => {
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
