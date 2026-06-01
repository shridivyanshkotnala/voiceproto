import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { getApiBaseUrl } from '../../config/apiBaseUrl'

const baseUrl = getApiBaseUrl()

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
