import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { login as apiLogin } from '../api/auth'
import type { Rol } from '../types/api'

interface AuthUser {
  nombre: string
  rol: Rol
}

interface AuthContextValue {
  user: AuthUser | null
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem('pos_user')
    return stored ? (JSON.parse(stored) as AuthUser) : null
  })

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin({ email, password })
    localStorage.setItem('pos_token', data.token)
    const u: AuthUser = { nombre: data.nombre, rol: data.rol }
    localStorage.setItem('pos_user', JSON.stringify(u))
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('pos_token')
    localStorage.removeItem('pos_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAdmin: user?.rol === 'ADMIN', login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
