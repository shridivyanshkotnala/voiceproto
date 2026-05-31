import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  messages: [
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        'Welcome to Pratham AI Assistant. Ask me anything about jewellery sales, operations, customer handling, or product recommendations.',
      timestamp: new Date().toISOString(),
    },
  ],
  loading: false,
}

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage(state, action) {
      state.messages.push(action.payload)
    },
    setLoading(state, action) {
      state.loading = action.payload
    },
    clearChat(state) {
      state.messages = []
      state.loading = false
    },
  },
})

export const { addMessage, setLoading, clearChat } = chatSlice.actions
export default chatSlice.reducer
