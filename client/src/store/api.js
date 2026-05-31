import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseUrl =
  import.meta.env.NEXT_PUBLIC_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:5000'

const baseUrl = rawBaseUrl.replace(/\/+$/, '')

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
