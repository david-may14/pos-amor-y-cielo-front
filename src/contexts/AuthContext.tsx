import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { login as apiLogin, revocarSesionRemota } from '../api/auth'
import { definirPin, verificarPin } from '../api/pin'
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
  /** Si este dispositivo tiene la sesión armada con PIN. null mientras se consulta IndexedDB. */
  hayPin: boolean | null
  /** Si el usuario ya definió un PIN en el servidor (lo dice el login). */
  usuarioTienePin: boolean
  login: (email: string, password: string) => Promise<{ tienePin: boolean }>
  /** Cierra sesión de verdad: revoca en el servidor y desarma este dispositivo. */
  logout: () => Promise<void>
  /** Bloqueo local: conserva el PIN para poder volver a entrar sin internet. */
  bloquear: () => void
  desbloquear: (pin: string) => Promise<ResultadoDesbloqueo>
  /** Crea el PIN en el servidor y arma este dispositivo con él. */
  crearPin: (pin: string, password: string) => Promise<void>
  /** El usuario ya tiene PIN: lo verifica contra el servidor y arma este dispositivo. */
  activarPin: (pin: string) => Promise<void>
  quitarPin: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getPerfil())
  const [hayPin, setHayPin] = useState<boolean | null>(null)
  const [usuarioTienePin, setUsuarioTienePin] = useState(false)

  const refrescarHayPin = useCallback(() => {
    tienePin().then(setHayPin).catch(() => setHayPin(false))
  }, [])

  useEffect(() => { refrescarHayPin() }, [refrescarHayPin])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin({ email, password })
    setUser(guardarSesion(data))
    setUsuarioTienePin(data.tienePin)
    return { tienePin: data.tienePin }
  }, [])

  /** Cifra la sesión de este dispositivo con el PIN ya validado. */
  const armarDispositivo = useCallback(async (pin: string, perfil: AuthUser) => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) throw new Error('No hay sesión activa para proteger con PIN')
    await configurarPin(pin, { refreshToken, nombre: perfil.nombre, rol: perfil.rol })
    setHayPin(true)
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

  const crearPin = useCallback(async (pin: string, password: string) => {
    if (!user) throw new Error('No hay usuario en sesión')
    await definirPin(password, pin)   // queda en el servidor, ligado al usuario
    await armarDispositivo(pin, user) // y cifra la sesión local con él
    setUsuarioTienePin(true)
  }, [user, armarDispositivo])

  const activarPin = useCallback(async (pin: string) => {
    if (!user) throw new Error('No hay usuario en sesión')
    // Verificar antes de cifrar: si se teclea mal, la sesión local quedaría
    // cifrada con un PIN que el usuario no conoce y nunca podría abrirla.
    await verificarPin(pin)
    await armarDispositivo(pin, user)
  }, [user, armarDispositivo])

  const quitarPin = useCallback(async () => {
    await borrarPin()
    setHayPin(false)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, isAdmin: user?.rol === 'ADMIN', hayPin, usuarioTienePin,
      login, logout, bloquear, desbloquear, crearPin, activarPin, quitarPin,
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
