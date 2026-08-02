import type { EstadoCocina, ComandaCocina } from '../types/api'
import { NetworkError } from './errores'

/**
 * Cliente de la pantalla de cocina.
 *
 * A propósito NO pasa por `client.ts`: ese inyecta el JWT y, ante un 401,
 * limpia la sesión y manda a /login. Aquí no hay sesión que perder — la tablet
 * de cocina nunca inició una — y ese redirect sacaría de la pantalla a quien
 * está trabajando. Son llamadas desnudas contra endpoints públicos.
 */

const BASE_URL = import.meta.env.VITE_API_URL as string

/** Error con el estado HTTP a la vista, para distinguir PIN malo de bloqueo. */
export class CocinaError extends Error {
  constructor(public readonly status: number, mensaje: string) {
    super(mensaje)
    this.name = 'CocinaError'
  }
}

async function pedir<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    })
  } catch {
    throw new NetworkError()
  }

  if (!res.ok) {
    let mensaje = `Error ${res.status}`
    try {
      const texto = await res.text()
      try {
        const json = JSON.parse(texto)
        mensaje = json.message || json.error || texto || mensaje
      } catch {
        if (texto) mensaje = texto
      }
    } catch { /* la conexión se cortó leyendo el cuerpo */ }
    throw new CocinaError(res.status, mensaje)
  }

  if (res.status === 204) return null as T
  return res.json() as Promise<T>
}

export const estadoCocina = () => pedir<EstadoCocina>('/api/cocina/comandas')

export const iniciarComanda = (id: number) =>
  pedir<ComandaCocina>(`/api/cocina/comandas/${id}/iniciar`, { method: 'POST' })

export const marcarComandaLista = (id: number) =>
  pedir<ComandaCocina>(`/api/cocina/comandas/${id}/listo`, { method: 'POST' })

export const revertirComanda = (id: number, pin: string) =>
  pedir<ComandaCocina>(`/api/cocina/comandas/${id}/revertir`, {
    method: 'POST',
    body: JSON.stringify({ pin }),
  })
