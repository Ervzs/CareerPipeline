import type { ApiErrorBody } from './types'

const BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: Record<string, string[] | string>

  constructor(status: number, code: string, message: string, details = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  /** First message for a field, e.g. fieldError('email'). */
  fieldError(field: string): string | undefined {
    const value = this.details[field]
    return Array.isArray(value) ? value[0] : value
  }
}

// The access token lives in memory only. The refresh token is an httpOnly cookie that
// JavaScript cannot read; the browser sends it to /api/auth/ when we ask for a refresh.
let accessToken: string | null = null
let refreshInFlight: Promise<string | null> | null = null
let onSessionExpired: (() => void) | null = null

export const setAccessToken = (token: string | null) => {
  accessToken = token
}
export const getAccessToken = () => accessToken

/** AuthProvider registers this so the UI can return to the login page when refresh fails. */
export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  onSessionExpired = handler
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody
    return new ApiError(response.status, body.error.code, body.error.message, body.error.details)
  } catch {
    return new ApiError(response.status, 'unknown_error', `Request failed (${response.status}).`)
  }
}

/**
 * Exchange the refresh cookie for a new access token. Concurrent callers share one
 * request: the refresh token rotates on use, so a second parallel call would fail.
 */
export function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE_URL}/api/auth/refresh/`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!response.ok) {
        accessToken = null
        return null
      }
      accessToken = ((await response.json()) as { access: string }).access
      return accessToken
    } catch {
      accessToken = null
      return null
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Auth endpoints must not trigger the refresh-and-retry flow. */
  skipAuthRetry?: boolean
}

function send(path: string, { method = 'GET', body }: RequestOptions) {
  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  return fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function api<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options)

  if (response.status === 401 && !options.skipAuthRetry) {
    const token = await refreshAccessToken()
    if (token) {
      response = await send(path, options)
    } else {
      onSessionExpired?.()
    }
  }

  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
