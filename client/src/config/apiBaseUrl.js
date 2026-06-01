const DEFAULT_LOCAL_API_URL = 'http://localhost:8000'
const DEFAULT_PROD_API_URL = 'https://voiceproto.onrender.com'

function normalize(url = '') {
  return String(url || '').trim().replace(/\/+$/, '')
}

export function getApiBaseUrl() {
  const envBaseUrl =
    import.meta.env.NEXT_PUBLIC_API_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL

  if (envBaseUrl) {
    return normalize(envBaseUrl)
  }

  if (import.meta.env.PROD) {
    return normalize(import.meta.env.VITE_PROD_API_URL || DEFAULT_PROD_API_URL)
  }

  return normalize(DEFAULT_LOCAL_API_URL)
}
