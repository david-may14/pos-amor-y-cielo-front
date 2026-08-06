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

/**
 * Como getCached, pero responde con lo cacheado SIN esperar a la red y refresca
 * por detrás para el próximo uso.
 *
 * Es para lo que se consulta en mitad de una venta, con el cliente enfrente:
 * ahí la diferencia entre responder al instante y esperar un viaje a Railway y
 * de ahí a Supabase se nota en cada toque. Los datos que la usan —modificadores
 * de un producto, descuentos vigentes— practicamente no cambian durante un
 * turno, así que servir la copia local y actualizarla después es un intercambio
 * barato.
 *
 * A cambio, un cambio hecho desde otro equipo tarda un toque en aparecer: el
 * primero devuelve lo viejo y deja lo nuevo listo para el siguiente.
 *
 * La primera vez que se pide algo no hay copia, así que ahí sí se espera.
 */
async function getCachedFirst<T>(key: string, path: string): Promise<T> {
  const entry = await offlineDb.cache.get(key).catch(() => undefined)
  if (!entry) return getCached<T>(key, path)

  // Sin await: el refresco no debe retrasar lo que ya podemos responder. Si
  // falla —sin red, sesión caída— se ignora y queda la copia local, que es
  // justo lo que se acaba de devolver.
  request<T>(path)
    .then((data) =>
      offlineDb.cache.put({ key, data, actualizadoEn: new Date().toISOString() }))
    .catch(() => {})

  return entry.data as T
}

/** Olvida lo cacheado bajo esas claves para que la próxima lectura vaya a la red. */
export async function invalidarCache(prefijo: string): Promise<void> {
  try {
    const claves = await offlineDb.cache.toCollection().primaryKeys()
    const aBorrar = claves.filter((k) => String(k).startsWith(prefijo))
    if (aBorrar.length > 0) await offlineDb.cache.bulkDelete(aBorrar)
  } catch {
    // Un caché que no se pudo limpiar sirve datos viejos; no vale tumbar nada por eso.
  }
}

/**
 * Como request(), pero devuelve la Response en crudo. La necesitan la descarga
 * de CSV (blob) y la importación (FormData), que no pueden pasar por el wrapper
 * JSON pero sí deben compartir su manejo de sesión y de red.
 */
async function peticionCruda(path: string, init: RequestInit, yaRenovado = false): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers })
  } catch {
    throw new NetworkError()
  }

  if (res.status === 401) {
    if (!yaRenovado) {
      const resultado = await renovarAccessToken()
      if (resultado === 'ok') return peticionCruda(path, init, true)
      if (resultado === 'sin-red') throw new NetworkError()
    }
    expulsarAlLogin()
  }

  if (!res.ok) {
    let text = ''
    try {
      text = await res.text()
    } catch {
      throw new NetworkError()
    }
    throw new Error(text || `Error ${res.status}`)
  }

  return res
}

/** Descarga un archivo del servidor y lo ofrece al usuario. */
export async function descargarArchivo(path: string, nombreArchivo: string): Promise<void> {
  const res = await peticionCruda(path, {})
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  a.click()
  URL.revokeObjectURL(url)
}

/** Sube un archivo como multipart. No fija Content-Type: el boundary lo pone el navegador. */
export async function subirArchivo<T>(path: string, file: File): Promise<T> {
  const form = new FormData()
  form.append('file', file)
  const res = await peticionCruda(path, { method: 'POST', body: form })
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getCached: <T>(key: string, path: string) => getCached<T>(key, path),
  getCachedFirst: <T>(key: string, path: string) => getCachedFirst<T>(key, path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
}
