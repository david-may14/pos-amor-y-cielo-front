import { offlineDb } from '../db/offlineDb'

const BASE_URL = import.meta.env.VITE_API_URL as string

/** Se lanza cuando el fetch falla por falta de conexión (no por un error del servidor). */
export class NetworkError extends Error {
  constructor(message = 'Sin conexión') {
    super(message)
    this.name = 'NetworkError'
  }
}

function getToken(): string | null {
  return localStorage.getItem('pos_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    localStorage.removeItem('pos_token')
    localStorage.removeItem('pos_user')
    sessionStorage.setItem('session_expired', '1')
    window.location.href = '/login'
    throw new Error('Sesión expirada')
  }

  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try {
      const json = JSON.parse(text)
      msg = json.message || json.error || text
    } catch { /* not JSON, use raw text */ }
    throw new Error(msg || `Error ${res.status}`)
  }

  if (res.status === 204) return null as T
  return res.json() as Promise<T>
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
    if (e instanceof NetworkError) {
      const entry = await offlineDb.cache.get(key)
      if (entry) return entry.data as T
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
