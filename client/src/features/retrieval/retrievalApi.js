import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const baseUrl =
  import.meta.env.NEXT_PUBLIC_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

export const retrievalApi = createApi({
  reducerPath: 'retrievalApi',
  baseQuery: fetchBaseQuery({ baseUrl }),
  endpoints: (builder) => ({
    searchKnowledge: builder.mutation({
      query: (payload) => ({
        url: '/api/v1/retrieval/search',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
})

export const { useSearchKnowledgeMutation } = retrievalApi
