import type { BaristaDTO } from '../types/api'

/**
 * Barista que atiende la caja ahora mismo.
 *
 * La sesión del equipo se queda abierta todo el turno; los baristas se turnan
 * con su PIN, como en un Oxxo. Quien esté activo es a nombre de quien quedan
 * las ventas y las propinas. null = el usuario de la sesión.
 *
 * Para poder cambiar sin internet, cada vez que alguien entra con su PIN
 * estando en línea se guarda aquí un verificador derivado con PBKDF2 (nunca el
 * PIN). Es el mismo nivel de protección que ya tiene la sesión cifrada con PIN
 * en este dispositivo.
 */

const K_ACTIVO = 'pos_barista_activo'
const K_LISTA = 'pos_baristas'
const K_VERIFICADORES = 'pos_baristas_pin'

const ITERACIONES = 100_000
export const MAX_FALLOS_LOCALES = 5

interface Verificador {
  salt: string
  hash: string
  fallos: number
}

function leer<T>(clave: string): T | null {
  try {
    const raw = localStorage.getItem(clave)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function escribir(clave: string, valor: unknown): void {
  try {
    if (valor === null) localStorage.removeItem(clave)
    else localStorage.setItem(clave, JSON.stringify(valor))
  } catch {
    // almacenamiento lleno o bloqueado: el cambio vale solo en memoria
  }
}

export const getBaristaActivo = (): BaristaDTO | null => leer<BaristaDTO>(K_ACTIVO)
export const setBaristaActivo = (b: BaristaDTO | null): void => escribir(K_ACTIVO, b)

/** Última lista conocida, para poder elegir barista sin conexión. */
export const getBaristasGuardados = (): BaristaDTO[] => leer<BaristaDTO[]>(K_LISTA) ?? []
export const guardarBaristas = (lista: BaristaDTO[]): void => escribir(K_LISTA, lista)

function aBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return btoa(String.fromCharCode(...arr))
}

function deBase64(texto: string): Uint8Array {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))
}

async function derivar(pin: string, salt: Uint8Array): Promise<string> {
  const base = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERACIONES, hash: 'SHA-256' },
    base,
    256,
  )
  return aBase64(bits)
}

const verificadores = (): Record<string, Verificador> =>
  leer<Record<string, Verificador>>(K_VERIFICADORES) ?? {}

/** Tras un cambio aceptado por el servidor: deja listo el cambio sin internet. */
export async function recordarPin(usuarioId: number, pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const todos = verificadores()
  todos[usuarioId] = { salt: aBase64(salt), hash: await derivar(pin, salt), fallos: 0 }
  escribir(K_VERIFICADORES, todos)
}

export type ResultadoLocal = 'ok' | 'incorrecto' | 'sin-verificador'

/**
 * Comprueba el PIN sin servidor. Tras cinco fallos se borra el verificador
 * de ese barista: tendrá que cambiar con internet la próxima vez.
 */
export async function verificarPinLocal(usuarioId: number, pin: string): Promise<ResultadoLocal> {
  const todos = verificadores()
  const v = todos[usuarioId]
  if (!v) return 'sin-verificador'
  if (await derivar(pin, deBase64(v.salt)) === v.hash) {
    if (v.fallos > 0) {
      todos[usuarioId] = { ...v, fallos: 0 }
      escribir(K_VERIFICADORES, todos)
    }
    return 'ok'
  }
  if (v.fallos + 1 >= MAX_FALLOS_LOCALES) delete todos[usuarioId]
  else todos[usuarioId] = { ...v, fallos: v.fallos + 1 }
  escribir(K_VERIFICADORES, todos)
  return 'incorrecto'
}

/** Al cerrar sesión de verdad: el equipo deja de recordar a nadie. */
export function olvidarBaristas(): void {
  escribir(K_ACTIVO, null)
  escribir(K_VERIFICADORES, null)
}
