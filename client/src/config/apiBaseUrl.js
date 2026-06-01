const DEFAULT_LOCAL_API_URL = 'http://localhost:8000'
const DEFAULT_PROD_API_URL = 'https://voiceproto.onrender.com'

function normalize(url = '') {
  return String(url || '').trim().replace(/\/+$/, '')
}

function isLocalhostUrl(url = '') {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

export function getApiBaseUrl() {
  const envBaseUrl =
    import.meta.env.NEXT_PUBLIC_API_URL ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL

  const normalizedEnvBaseUrl = normalize(envBaseUrl)

  // Safety net: if production env is accidentally set to localhost,
  // use deployed backend URL instead of browser localhost.
  if (import.meta.env.PROD && isLocalhostUrl(normalizedEnvBaseUrl)) {
    return normalize(import.meta.env.VITE_PROD_API_URL || DEFAULT_PROD_API_URL)
  }

  if (normalizedEnvBaseUrl) {
    return normalizedEnvBaseUrl
  }

  if (import.meta.env.PROD) {
    return normalize(import.meta.env.VITE_PROD_API_URL || DEFAULT_PROD_API_URL)
  }

  return normalize(DEFAULT_LOCAL_API_URL)
}
