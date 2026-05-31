import { configureStore } from '@reduxjs/toolkit'
import chatReducer from './chatSlice'
import settingsReducer from './settingsSlice'
import { voiceApi } from '../features/voice/voiceApi'
import voiceReducer from '../features/voice/voiceSlice'
import { languageApi } from '../features/language/languageApi'
import languageReducer from '../features/language/languageSlice'
import { knowledgeApi } from '../features/knowledge/knowledgeApi'
import { retrievalApi } from '../features/retrieval/retrievalApi'
import { responseApi } from '../features/response/responseApi'
import { pronunciationApi } from '../features/pronunciation/pronunciationApi'

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    settings: settingsReducer,
    voice: voiceReducer,
    language: languageReducer,
    [voiceApi.reducerPath]: voiceApi.reducer,
    [languageApi.reducerPath]: languageApi.reducer,
    [knowledgeApi.reducerPath]: knowledgeApi.reducer,
    [retrievalApi.reducerPath]: retrievalApi.reducer,
    [responseApi.reducerPath]: responseApi.reducer,
    [pronunciationApi.reducerPath]: pronunciationApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      voiceApi.middleware,
      languageApi.middleware,
      knowledgeApi.middleware,
      retrievalApi.middleware,
      responseApi.middleware,
      pronunciationApi.middleware,
    ),
})
