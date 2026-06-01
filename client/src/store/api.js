import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getApiBaseUrl } from '../config/apiBaseUrl'

const baseUrl = getApiBaseUrl()

export const voiceApi = createApi({
  reducerPath: 'voiceApi',
  baseQuery: fetchBaseQuery({ baseUrl }),
  tagTypes: ['Transcription'],
  endpoints: (builder) => ({
    transcribeAudio: builder.mutation({
      query: (formData) => ({
        url: '/api/v1/voice/transcribe',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Transcription'],
    }),
  }),
})

export const { useTranscribeAudioMutation } = voiceApi
