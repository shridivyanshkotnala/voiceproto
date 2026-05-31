import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseUrl =
  import.meta.env.NEXT_PUBLIC_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

const baseUrl = rawBaseUrl.replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000)

export const languageApi = createApi({
  reducerPath: 'languageApi',
  baseQuery: fetchBaseQuery({ baseUrl, timeout: REQUEST_TIMEOUT_MS }),
  tagTypes: ['LanguageProfile'],
  endpoints: (builder) => ({
    analyzeLanguage: builder.mutation({
      query: (payload) => ({
        url: '/api/v1/language/analyze',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['LanguageProfile'],
    }),
  }),
})

export const { useAnalyzeLanguageMutation } = languageApi
