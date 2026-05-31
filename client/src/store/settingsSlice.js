import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  voiceProfile: 'luxury_female',
  responseStyle: 'english',
  voiceStatus: 'idle',
}

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setVoiceProfile(state, action) {
      state.voiceProfile = action.payload
    },
    setResponseStyle(state, action) {
      state.responseStyle = action.payload
    },
    setVoiceStatus(state, action) {
      state.voiceStatus = action.payload
    },
  },
})

export const { setVoiceProfile, setResponseStyle, setVoiceStatus } =
  settingsSlice.actions

export default settingsSlice.reducer
