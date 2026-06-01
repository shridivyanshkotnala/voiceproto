import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getApiBaseUrl } from '../../config/apiBaseUrl'

const baseUrl = getApiBaseUrl()

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