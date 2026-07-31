import { offlineDb } from '../db/offlineDb'
import { NetworkError, esErrorDeRed } from './errores'
import { getToken, limpiarSesion, renovarAccessToken } from './sesion'

// Reexportados por comodidad: media app importa NetworkError desde aquí.
export { NetworkError, esErrorDeRed } from './errores'

const BASE_URL = import.meta.env.VITE_API_URL as string

/** Ruta a la que se manda al usuario cuando ya no hay forma de recuperar la sesión. */
function expulsarAlLogin(): never {
  limpiarSesion()
  sessionStorage.setItem('session_expired', '1')
  window.location.href = '/login'
  throw new Error('Sesión expirada')
}

async function request<T>(path: string, options: RequestInit = {}, yaRenovado = false): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw new NetworkError()
  }

  if (res.status === 401) {
    // El access token caducó: intentamos renovarlo con el refresh token antes
    // de dar la sesión por perdida. Solo se reintenta una vez.
    if (!yaRenovado) {
      const resultado = await renovarAccessToken()
      if (resultado === 'ok') return request<T>(path, options, true)
      // Sin red no sabemos si el refresh sigue sirviendo: no cerramos sesión.
      if (resultado === 'sin-red') throw new NetworkError()
    }
    expulsarAlLogin()
  }

  if (!res.ok) {
    let text: string
    try {
      text = await res.text()
    } catch {
      // la conexión se cortó mientras leíamos el cuerpo
      throw new NetworkError()
    }
    let msg = text
    try {
      const json = JSON.parse(text)
      msg = json.message || json.error || text
    } catch { /* not JSON, use raw text */ }
    throw new Error(msg || `Error ${res.status}`)
  }

  if (res.status === 204) return null as T
  try {
    return await (res.json() as Promise<T>)
  } catch (e) {
    if (esErrorDeRed(e)) throw new NetworkError()
    throw e
  }
}

/**
 * Como api.get, pero cachea la respuesta en IndexedDB y, si el fetch falla
 * por falta de conexión, devuelve la última versión cacheada bajo esa key.
 */
async function getCached<T>(key: string, path: string): Promise<T> {
  try {
    const data = await request<T>(path)
    offlineDb.cache.put({ key, data, actualizadoEn: new Date().toISOString() }).catch(() => {})
    return data
  } catch (e) {
    if (esErrorDeRed(e)) {
      const entry = await offlineDb.cache.get(key).catch(() => undefined)
      if (entry) return entry.data as T
      throw new NetworkError()
    }
    throw e
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getCached: <T>(key: string, path: string) => getCached<T>(key, path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
