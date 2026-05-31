import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError } from '../src/utils/ApiError.js'
import { ApiResponse } from '../src/utils/ApiResponse.js'
import { asyncHandler } from '../src/utils/asyncHandler.js'

// Validates ApiError structure for consistent error handling.
// Input: status code + message
// Output: standardized error properties.
test('ApiError sets statusCode and success', () => {
  const error = new ApiError(400, 'Bad Request')
  assert.equal(error.statusCode, 400)
  assert.equal(error.message, 'Bad Request')
  assert.equal(error.success, false)
})

// Validates ApiResponse structure for successful payloads.
// Input: status code + message + data
// Output: standardized response properties.
test('ApiResponse sets success and data', () => {
  const response = new ApiResponse(200, 'OK', { hello: 'world' })
  assert.equal(response.statusCode, 200)
  assert.equal(response.success, true)
  assert.equal(response.data.hello, 'world')
})

// Ensures asyncHandler forwards errors to Express error middleware.
// Input: async controller throwing error
// Output: next called with error.
test('asyncHandler forwards errors', async () => {
  const error = new Error('boom')
  const handler = asyncHandler(async () => {
    throw error
  })

  let forwarded
  await handler(
    {},
    {},
    (err) => {
      forwarded = err
    },
  )

  assert.equal(forwarded, error)
})
