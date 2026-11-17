// Shared API configuration and helpers.
// Every module that talks to the backend imports from here so the base URL logic
// and the auth header live in exactly one place.

const PRODUCTION_FALLBACK_API = 'https://levelupp-2b3j.onrender.com'
export const AUTH_TOKEN_KEY = 'levelup-auth-token'

function normalizeApiBaseUrl(value?: string): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const withoutTrailingSlash = raw.replace(/\/+$/, '')
  try {
    const url = new URL(withoutTrailingSlash)
    return `${url.protocol}//${url.host}`
  } catch {
    return withoutTrailingSlash
  }
}

function resolveApiBaseUrl(): string {
  const configured = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
  if (configured) return configured

  const isLocalDevelopment = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
  if (isLocalDevelopment) return 'http://localhost:8787'

  return import.meta.env.PROD ? PRODUCTION_FALLBACK_API : 'http://localhost:8787'
}

export const API_BASE_URL = resolveApiBaseUrl()

export function getStoredAuthToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    const raw = window.localStorage.getItem(AUTH_TOKEN_KEY) ?? ''
    // Older builds stored the token JSON-encoded ("…" with quotes); accept both forms.
    return raw.replace(/^"(.*)"$/, '$1')
  } catch {
    return ''
  }
}

/** Returns a Headers object with the bearer token attached (when logged in). */
export function withAuthHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init ?? {})
  const token = getStoredAuthToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

/**
 * fetch + JSON parsing + error normalisation. Throws an Error whose message is the
 * backend's `error` field when the response is not OK.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`
  const response = await fetch(url, { ...init, headers: withAuthHeaders(init?.headers) })
  const payload = await response.json().catch(() => ({})) as { error?: string }
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed (${response.status})`)
  }
  return payload as T
}

/** crypto.randomUUID is unavailable on plain-http LAN origins; fall back safely. */
export function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID()
    } catch {
      // insecure context — fall through
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
