import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  isStreaming: false,
  isSpeaking: false,
  currentSentence: '',
  audioProgress: {
    totalChunks: 0,
    lastChunkBytes: 0,
  },
  streamMetrics: {
    timeToFirstToken: null,
    timeToFirstSentence: null,
    timeToFirstAudio: null,
    totalGenerationTime: null,
    totalTTSTime: null,
    streamDuration: null,
  },
  streamStatus: 'IDLE',
}

const voiceStreamingSlice = createSlice({
  name: 'voiceStreaming',
  initialState,
  reducers: {
    setStreaming(state, action) {
      state.isStreaming = Boolean(action.payload)
    },
    setSpeaking(state, action) {
      state.isSpeaking = Boolean(action.payload)
    },
    setCurrentSentence(state, action) {
      state.currentSentence = String(action.payload || '')
    },
    incrementAudioProgress(state, action) {
      const bytes = Number(action.payload || 0)
      state.audioProgress.totalChunks += 1
      state.audioProgress.lastChunkBytes = Number.isFinite(bytes) ? bytes : 0
    },
    setStreamStatus(state, action) {
      state.streamStatus = String(action.payload || 'IDLE')
    },
    setStreamMetrics(state, action) {
      state.streamMetrics = {
        ...state.streamMetrics,
        ...(action.payload || {}),
      }
    },
    resetVoiceStreamingState() {
      return { ...initialState }
    },
  },
})

export const {
  setStreaming,
  setSpeaking,
  setCurrentSentence,
  incrementAudioProgress,
  setStreamStatus,
  setStreamMetrics,
  resetVoiceStreamingState,
} = voiceStreamingSlice.actions

export default voiceStreamingSlice.reducer
