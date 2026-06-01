import '../loadEnv.js'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const knowledgeFilePath =
  process.env.KNOWLEDGE_FILE_PATH ||
  path.resolve(__dirname, '..', 'knowledge.txt')

const uploadUrl =
  process.env.KNOWLEDGE_UPLOAD_URL ||
  'http://localhost:8000/api/v1/knowledge/upload'

const sessionId = process.env.KNOWLEDGE_UPLOAD_SESSION || 'knowledge-seed'

async function uploadKnowledge() {
  const fileBuffer = await fs.readFile(knowledgeFilePath)
  const formData = new FormData()
  formData.append(
    'file',
    new Blob([fileBuffer]),
    path.basename(knowledgeFilePath),
  )

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'x-session-id': sessionId,
    },
    body: formData,
  })

  const responseText = await response.text()
  if (!response.ok) {
    throw new Error(
      `Knowledge upload failed (${response.status}): ${responseText}`,
    )
  }

  console.log(responseText)
}

uploadKnowledge().catch((error) => {
  console.error(error?.message || error)
  process.exit(1)
})
