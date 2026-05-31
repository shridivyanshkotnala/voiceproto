import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseUrl =
  import.meta.env.NEXT_PUBLIC_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

const baseUrl = rawBaseUrl.replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000)

export const voiceApi = createApi({
  reducerPath: 'voiceApi',
  baseQuery: fetchBaseQuery({ baseUrl, timeout: REQUEST_TIMEOUT_MS }),
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
    synthesizeVoice: builder.mutation({
      async queryFn(payload, api, extraOptions, baseQuery) {
        const { text, voiceProfile, sessionId } = payload || {}

        const result = await baseQuery({
          url: '/api/v1/voice/synthesize',
          method: 'POST',
          body: { text, voiceProfile },
          headers: sessionId ? { 'x-session-id': sessionId } : undefined,
          responseHandler: (response) => response.blob(),
        })

        if (result.error) {
          return { error: result.error }
        }

        const durationHeader = result?.meta?.response?.headers?.get(
          'x-audio-duration',
        )
        const audioDuration = durationHeader ? Number(durationHeader) : null
        const audioUrl = URL.createObjectURL(result.data)

        return {
          data: {
            audioUrl,
            audioDuration,
          },
        }
      },
    }),
  }),
})

export const {
  useTranscribeAudioMutation,
  useSynthesizeVoiceMutation,
} = voiceApi
