import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  currentState: 'IDLE',
  isRecording: false,
  isProcessing: false,
  isSpeaking: false,
  connectionStatus: 'disconnected',
  lastError: null,
  lastStatus: null,
  metrics: {
    timeToTranscript: null,
    timeToResponse: null,
    timeToFirstAudio: null,
    totalConversationTime: null,
  },
}

const realtimeSlice = createSlice({
  name: 'realtime',
  initialState,
  reducers: {
    setRealtimeState(state, action) {
      state.currentState = action.payload
    },
    setRecording(state, action) {
      state.isRecording = action.payload
    },
    setProcessing(state, action) {
      state.isProcessing = action.payload
    },
    setSpeaking(state, action) {
      state.isSpeaking = action.payload
    },
    setConnectionStatus(state, action) {
      state.connectionStatus = action.payload
    },
    setRealtimeError(state, action) {
      state.lastError = action.payload
    },
    setRealtimeStatus(state, action) {
      state.lastStatus = action.payload
    },
    setRealtimeMetrics(state, action) {
      state.metrics = {
        ...state.metrics,
        ...action.payload,
      }
    },
    resetRealtimeState() {
      return { ...initialState }
    },
  },
})

export const {
  setRealtimeState,
  setRecording,
  setProcessing,
  setSpeaking,
  setConnectionStatus,
  setRealtimeError,
  setRealtimeStatus,
  setRealtimeMetrics,
  resetRealtimeState,
} = realtimeSlice.actions

export default realtimeSlice.reducer
