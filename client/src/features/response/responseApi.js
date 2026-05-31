import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseUrl =
  import.meta.env.NEXT_PUBLIC_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

const baseUrl = rawBaseUrl.replace(/\/+$/, '')
const REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000)

export const responseApi = createApi({
  reducerPath: 'responseApi',
  baseQuery: fetchBaseQuery({ baseUrl, timeout: REQUEST_TIMEOUT_MS }),
  endpoints: (builder) => ({
    generateResponse: builder.mutation({
      query: (payload) => ({
        url: '/api/v1/response/generate',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
})

export const { useGenerateResponseMutation } = responseApi
