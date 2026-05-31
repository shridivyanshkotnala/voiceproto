import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseUrl =
  import.meta.env.NEXT_PUBLIC_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

const baseUrl = rawBaseUrl.replace(/\/+$/, '')

export const pronunciationApi = createApi({
  reducerPath: 'pronunciationApi',
  baseQuery: fetchBaseQuery({ baseUrl }),
  endpoints: (builder) => ({
    optimizePronunciation: builder.mutation({
      query: (payload) => ({
        url: '/api/v1/pronunciation/optimize',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
})

export const { useOptimizePronunciationMutation } = pronunciationApi