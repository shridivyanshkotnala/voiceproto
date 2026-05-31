import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

const rawBaseUrl =
  import.meta.env.NEXT_PUBLIC_API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:8000'

const baseUrl = rawBaseUrl.replace(/\/+$/, '')

export const knowledgeApi = createApi({
  reducerPath: 'knowledgeApi',
  baseQuery: fetchBaseQuery({ baseUrl }),
  tagTypes: ['Knowledge'],
  endpoints: (builder) => ({
    uploadKnowledge: builder.mutation({
      query: (formData) => ({
        url: '/api/v1/knowledge/upload',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['Knowledge'],
    }),
    getKnowledgeStats: builder.query({
      query: () => '/api/v1/knowledge/stats',
      providesTags: ['Knowledge'],
    }),
    searchKnowledge: builder.mutation({
      query: (payload) => ({
        url: '/api/v1/knowledge/search',
        method: 'POST',
        body: payload,
      }),
    }),
  }),
})

export const {
  useUploadKnowledgeMutation,
  useGetKnowledgeStatsQuery,
  useSearchKnowledgeMutation,
} = knowledgeApi
