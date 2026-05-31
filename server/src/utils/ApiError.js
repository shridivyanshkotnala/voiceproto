// Standardized application error for consistent API responses.
// Input: statusCode, message
// Output: Error instance with success flag.
export class ApiError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.success = false
  }
}
