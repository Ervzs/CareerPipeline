import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { api, refreshAccessToken, setAccessToken, setSessionExpiredHandler } from '../lib/api'
import type { User } from '../lib/types'
import { AuthContext } from './useAuth'
import type { AuthStatus } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setUser(null)
    setStatus('anonymous')
    queryClient.clear()
  }, [queryClient])

  // Silent refresh on load: the httpOnly cookie survives page reloads, the access token doesn't.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = await refreshAccessToken()
      if (!token) {
        if (!cancelled) clearSession()
        return
      }
      try {
        const me = await api<User>('/api/auth/me/')
        if (!cancelled) {
          setUser(me)
          setStatus('authenticated')
        }
      } catch {
        if (!cancelled) clearSession()
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clearSession])

  // If a refresh fails mid-session, send the user back to the login page.
  useEffect(() => {
    setSessionExpiredHandler(clearSession)
    return () => setSessionExpiredHandler(null)
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const { access } = await api<{ access: string }>('/api/auth/login/', {
      method: 'POST',
      body: { email, password },
      skipAuthRetry: true,
    })
    setAccessToken(access)
    setUser(await api<User>('/api/auth/me/'))
    setStatus('authenticated')
  }, [])

  const register = useCallback(
    async (email: string, password: string) => {
      await api('/api/auth/register/', {
        method: 'POST',
        body: { email, password },
        skipAuthRetry: true,
      })
      await login(email, password)
    },
    [login],
  )

  const loginDemo = useCallback(
    () =>
      login(
        import.meta.env.VITE_DEMO_EMAIL ?? 'demo@careerpipeline.dev',
        import.meta.env.VITE_DEMO_PASSWORD ?? 'DemoPipeline2026!',
      ),
    [login],
  )

  const logout = useCallback(async () => {
    try {
      await api('/api/auth/logout/', { method: 'POST', skipAuthRetry: true })
    } catch {
      // Server unreachable: the local session is cleared below either way.
    }
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({ user, status, login, register, loginDemo, logout }),
    [user, status, login, register, loginDemo, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
