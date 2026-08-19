import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { authApi } from '@/api/auth'
import { AUTH_EVENTS } from '@/lib/axios'
import { getApiErrorMessage } from '@/lib/axios'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadUser = useCallback(async () => {
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // On first mount, silently check for an existing session via the
  // httpOnly cookies (there is nothing in localStorage to check instead).
  useEffect(() => {
    loadUser()
  }, [loadUser])

  // If the axios interceptor gives up on refreshing (refresh token itself
  // expired / invalid), drop the session client-side too.
  useEffect(() => {
    const onExpire = () => setUser(null)
    window.addEventListener(AUTH_EVENTS.SESSION_EXPIRED, onExpire)
    return () => window.removeEventListener(AUTH_EVENTS.SESSION_EXPIRED, onExpire)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    try {
      await authApi.login({ email, password })
    } catch (err) {
      throw new Error(getApiErrorMessage(err))
    }
    const me = await authApi.me()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshUser: loadUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
