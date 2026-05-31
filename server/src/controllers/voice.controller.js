import fs from 'fs/promises'
import { pipeline } from 'stream/promises'
import { ApiError } from '../utils/ApiError.js'
import { ApiResponse } from '../utils/ApiResponse.js'
import { transcribeAudio } from '../services/stt.service.js'
import { synthesizeVoice } from '../services/voice.service.js'

// Temporary in-memory storage for transcripts.
// Future: replace with database or message queue for AI pipeline.
const transcriptStore = []

// Accepts uploaded audio and returns transcription.
// Input: multipart/form-data (audio file)
// Output: ApiResponse with transcript.
export async function transcribeAudioController(req, res) {
  if (!req.file) {
    throw new ApiError(400, 'No audio file uploaded')
  }

  const { path: filePath, mimetype, originalname } = req.file

  try {
    const stats = await fs.stat(filePath)
    if (!stats.size) {
      throw new ApiError(400, 'Empty audio file.')
    }

    const transcript = await transcribeAudio(filePath, mimetype, originalname)

    transcriptStore.push({
      transcript,
      createdAt: new Date().toISOString(),
    })

    return res
      .status(200)
      .json(
        new ApiResponse(200, 'Audio transcribed successfully', { transcript }),
      )
  } finally {
    await fs.unlink(filePath).catch(() => null)
  }
}

// Streams synthesized audio from ElevenLabs.
// Input: { text, voiceProfile }
// Output: audio/mpeg stream.
export async function synthesizeVoiceController(req, res) {
  const { text, voiceProfile } = req.body
  const sessionId =
    req.headers['x-session-id'] || req.body?.sessionId || 'anonymous'

  const { stream, contentType, audioDuration } = await synthesizeVoice({
    text,
    voiceProfile,
    sessionId,
  })

  res.status(200)
  res.setHeader('Content-Type', contentType)
  if (audioDuration !== null && audioDuration !== undefined) {
    res.setHeader('x-audio-duration', String(audioDuration))
  }

  try {
    await pipeline(stream, res)
  } catch (error) {
    if (res.headersSent) {
      res.end()
      return
    }
    throw new ApiError(502, 'Audio streaming failed.')
  }
}
