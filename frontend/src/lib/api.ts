const API_URL = import.meta.env.VITE_API_URL

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

async function refreshAccessToken() {
  const response = await fetch(`${API_URL}/api/auth/refresh/`, {
    method: "POST",
    credentials: "include",
  })
  accessToken = response.ok ? (await response.json()).access : null
  return response.ok
}

function send(path: string, options: RequestInit) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  })
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response = await send(path, options)
  if (response.status === 401 && (await refreshAccessToken())) {
    response = await send(path, options)
  }
  if (!response.ok) {
    const data: Record<string, string | string[]> = await response.json().catch(() => ({}))
    throw new Error(Object.values(data).flat()[0] ?? `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json()
}
