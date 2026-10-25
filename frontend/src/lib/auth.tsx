import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { api } from './api'
import { useToast } from './toast'
import type { ResourceResponse, User } from '../types/api'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  user: User | null
  status: AuthStatus
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
  changePassword: (values: {
    current_password: string
    password: string
    password_confirmation: string
  }) => Promise<User>
  has: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const userRef = useRef<User | null>(null)

  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    let active = true

    api<ResourceResponse<User>>('/auth/me', { suppressAuthEvent: true })
      .then((response) => {
        if (!active) return
        setUser(response.data)
        setStatus('authenticated')
      })
      .catch(() => {
        if (!active) return
        setUser(null)
        setStatus('unauthenticated')
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      const hadSession = userRef.current !== null
      userRef.current = null
      setUser(null)
      setStatus('unauthenticated')
      queryClient.clear()

      if (hadSession) {
        toast('error', 'Sesi berakhir', 'Silakan masuk kembali untuk melanjutkan.')
      }
    }

    window.addEventListener('app:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('app:unauthorized', handleUnauthorized)
  }, [queryClient, toast])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api<ResourceResponse<User>>('/auth/login', {
      method: 'POST',
      body: { email, password },
      suppressAuthEvent: true,
    })
    setUser(response.data)
    setStatus('authenticated')
    return response.data
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST', suppressAuthEvent: true })
    } finally {
      userRef.current = null
      setUser(null)
      setStatus('unauthenticated')
      queryClient.clear()
    }
  }, [queryClient])

  const changePassword = useCallback(
    async (values: {
      current_password: string
      password: string
      password_confirmation: string
    }) => {
      const response = await api<ResourceResponse<User>>('/auth/password', {
        method: 'PUT',
        body: values,
      })
      setUser(response.data)
      userRef.current = response.data
      setStatus('authenticated')
      return response.data
    },
    [],
  )

  const has = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, changePassword, has }),
    [user, status, login, logout, changePassword, has],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return context
}
