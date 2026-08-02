import { esErrorDeRed } from './errores'
import type { LoginResponse, Rol } from '../types/api'

const BASE_URL = import.meta.env.VITE_API_URL as string

const K_TOKEN = 'pos_token'
const K_REFRESH = 'pos_refresh_token'
const K_USER = 'pos_user'

export interface PerfilGuardado {
  nombre: string
  rol: Rol
}

export const getToken = (): string | null => localStorage.getItem(K_TOKEN)
export const getRefreshToken = (): string | null => localStorage.getItem(K_REFRESH)

export function getPerfil(): PerfilGuardado | null {
  const raw = localStorage.getItem(K_USER)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PerfilGuardado
  } catch {
    return null
  }
}

/** Guarda la sesión completa devuelta por /login o /refresh. */
export function guardarSesion(data: LoginResponse): PerfilGuardado {
  localStorage.setItem(K_TOKEN, data.token)
  if (data.refreshToken) localStorage.setItem(K_REFRESH, data.refreshToken)
  const perfil: PerfilGuardado = { nombre: data.nombre, rol: data.rol }
  localStorage.setItem(K_USER, JSON.stringify(perfil))
  return perfil
}

/**
 * Repone la sesión tras un desbloqueo con PIN. No hay access token todavía:
 * el primer 401 lo pedirá con este refresh token, y sin red simplemente se
 * trabaja offline hasta que vuelva.
 */
export function restaurarSesionDesdePin(refreshToken: string, perfil: PerfilGuardado): void {
  localStorage.setItem(K_REFRESH, refreshToken)
  localStorage.setItem(K_USER, JSON.stringify(perfil))
  localStorage.removeItem(K_TOKEN)
}

export function limpiarSesion(): void {
  localStorage.removeItem(K_TOKEN)
  localStorage.removeItem(K_REFRESH)
  localStorage.removeItem(K_USER)
}

/** Nombre legible del equipo, para poder revocarlo desde el servidor. */
export function etiquetaDispositivo(): string {
  const ua = navigator.userAgent
  const plataforma = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : 'Escritorio'
  return `${plataforma} · ${navigator.language}`
}

export type ResultadoRenovacion = 'ok' | 'sin-sesion' | 'sin-red'

let renovacionEnCurso: Promise<ResultadoRenovacion> | null = null

/**
 * Canjea el refresh token por un access token nuevo.
 *
 * Single-flight: si llegan varios 401 a la vez (típico al recuperar la red con
 * la cola llena) solo se dispara una renovación y todos esperan la misma.
 *
 * No usa el wrapper `api` a propósito: este endpoint responde 401 cuando el
 * refresh no sirve, y pasarlo por el interceptor sería recursión infinita.
 */
export function renovarAccessToken(): Promise<ResultadoRenovacion> {
  if (renovacionEnCurso) return renovacionEnCurso
  renovacionEnCurso = ejecutarRenovacion().finally(() => { renovacionEnCurso = null })
  return renovacionEnCurso
}

async function ejecutarRenovacion(): Promise<ResultadoRenovacion> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return 'sin-sesion'

  let res: Response
  try {
    res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken, dispositivo: etiquetaDispositivo() }),
    })
  } catch {
    // Sin red no podemos saber si el refresh sigue siendo válido: NO cerramos sesión.
    return 'sin-red'
  }

  if (res.status === 401 || res.status === 400) return 'sin-sesion'
  if (!res.ok) return 'sin-red' // 5xx o similar: el token puede seguir bueno, reintentaremos

  try {
    const data = (await res.json()) as LoginResponse
    guardarSesion(data)
    return 'ok'
  } catch {
    return 'sin-red'
  }
}
