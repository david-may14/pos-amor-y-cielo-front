import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { login as apiLogin, revocarSesionRemota } from '../api/auth'
import {
  getPerfil, getRefreshToken, guardarSesion, limpiarSesion,
  renovarAccessToken, restaurarSesionDesdePin,
} from '../api/sesion'
import {
  borrarPin, configurarPin, desbloquearConPin, tienePin,
  type ResultadoDesbloqueo,
} from '../db/pinSesion'
import type { Rol } from '../types/api'

interface AuthUser {
  nombre: string
  rol: Rol
}

interface AuthContextValue {
  user: AuthUser | null
  isAdmin: boolean
  /** null mientras se consulta IndexedDB al arrancar. */
  hayPin: boolean | null
  login: (email: string, password: string) => Promise<void>
  /** Cierra sesión de verdad: revoca en el servidor y borra el PIN. */
  logout: () => Promise<void>
  /** Bloqueo local: conserva el PIN para poder volver a entrar sin internet. */
  bloquear: () => void
  desbloquear: (pin: string) => Promise<ResultadoDesbloqueo>
  /** Guarda un PIN para la sesión actual. */
  crearPin: (pin: string) => Promise<void>
  quitarPin: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getPerfil())
  const [hayPin, setHayPin] = useState<boolean | null>(null)

  const refrescarHayPin = useCallback(() => {
    tienePin().then(setHayPin).catch(() => setHayPin(false))
  }, [])

  useEffect(() => { refrescarHayPin() }, [refrescarHayPin])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin({ email, password })
    setUser(guardarSesion(data))
  }, [])

  const logout = useCallback(async () => {
    await revocarSesionRemota()
    await borrarPin().catch(() => {})
    limpiarSesion()
    setUser(null)
    setHayPin(false)
  }, [])

  const bloquear = useCallback(() => {
    // El refresh token solo sobrevive dentro del blob cifrado con el PIN.
    limpiarSesion()
    setUser(null)
  }, [])

  const desbloquear = useCallback(async (pin: string): Promise<ResultadoDesbloqueo> => {
    const res = await desbloquearConPin(pin)
    if (!res.ok) {
      if (res.motivo === 'bloqueado' || res.motivo === 'sin-pin') setHayPin(false)
      return res
    }
    const perfil = { nombre: res.sesion.nombre, rol: res.sesion.rol }
    restaurarSesionDesdePin(res.sesion.refreshToken, perfil)
    setUser(perfil)
    // Si hay red, estrenamos access token de una vez; si no, ya se pedirá solo.
    renovarAccessToken().catch(() => {})
    return res
  }, [])

  const crearPin = useCallback(async (pin: string) => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new Error('No hay sesión activa para proteger con PIN')
    if (!user) throw new Error('No hay usuario en sesión')
    await configurarPin(pin, { refreshToken, nombre: user.nombre, rol: user.rol })
    setHayPin(true)
  }, [user])

  const quitarPin = useCallback(async () => {
    await borrarPin()
    setHayPin(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isAdmin: user?.rol === 'ADMIN', hayPin,
      login, logout, bloquear, desbloquear, crearPin, quitarPin,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
