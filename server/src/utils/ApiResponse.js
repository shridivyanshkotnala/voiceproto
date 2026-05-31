// Standardized API response wrapper.
// Input: statusCode, message, data
// Output: structured response object.
export class ApiResponse {
  constructor(statusCode, message, data = null) {
    this.statusCode = statusCode
    this.success = true
    this.message = message
    this.data = data
  }
}
