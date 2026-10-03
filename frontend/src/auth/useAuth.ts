import { createContext, useContext } from 'react'
import type { User } from '../lib/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthValue {
  user: User | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  loginDemo: () => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
