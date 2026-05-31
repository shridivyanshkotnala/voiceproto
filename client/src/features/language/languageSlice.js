import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  language: 'english',
  hinglishStyle: 'business',
  formality: 'professional',
  complexity: 'medium',
  persona: 'customer',
  preferredResponseStyle: 'same_as_user',
  intent: 'general',
  confidence: 0,
  cleanedMessage: '',
  sessionId: '',
  usage: {
    model: '',
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
  },
}

const languageSlice = createSlice({
  name: 'language',
  initialState,
  reducers: {
    setLanguageProfile(state, action) {
      const payload = action.payload
      state.language = payload.language
      state.hinglishStyle = payload.hinglishStyle
      state.formality = payload.formality
      state.complexity = payload.complexity
      state.persona = payload.persona
      state.preferredResponseStyle = payload.preferredResponseStyle
      state.intent = payload.intent
      state.confidence = payload.confidence
      state.cleanedMessage = payload.cleanedMessage
      state.sessionId = payload.sessionId
      state.usage = payload.usage || state.usage
    },
  },
})

export const { setLanguageProfile } = languageSlice.actions
export default languageSlice.reducer
