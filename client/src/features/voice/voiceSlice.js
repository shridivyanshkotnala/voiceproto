import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  selectedVoiceProfile: 'LUXURY_FEMALE',
  audioLoading: false,
  audioPlaying: false,
  audioError: null,
  lastGeneratedAudio: null,
}

const voiceSlice = createSlice({
  name: 'voice',
  initialState,
  reducers: {
    setSelectedVoiceProfile(state, action) {
      state.selectedVoiceProfile = action.payload
    },
    setAudioLoading(state, action) {
      state.audioLoading = action.payload
    },
    setAudioPlaying(state, action) {
      state.audioPlaying = action.payload
    },
    setAudioError(state, action) {
      state.audioError = action.payload
    },
    setLastGeneratedAudio(state, action) {
      state.lastGeneratedAudio = action.payload
    },
    clearAudio(state) {
      state.lastGeneratedAudio = null
      state.audioError = null
      state.audioPlaying = false
      state.audioLoading = false
    },
  },
})

export const {
  setSelectedVoiceProfile,
  setAudioLoading,
  setAudioPlaying,
  setAudioError,
  setLastGeneratedAudio,
  clearAudio,
} = voiceSlice.actions

export default voiceSlice.reducer