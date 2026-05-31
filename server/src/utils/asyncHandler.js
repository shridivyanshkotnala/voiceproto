// Wraps async route handlers and forwards errors to Express error middleware.
// Input: async (req, res, next) => {}
// Output: function with automatic error forwarding.
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next)
}
