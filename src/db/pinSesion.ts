import { offlineDb, type SesionPin } from './offlineDb'
import type { Rol } from '../types/api'

/**
 * Desbloqueo local de la sesión con un PIN, para poder abrir la caja sin
 * internet cuando no hay sesión activa (p.ej. tras cerrar sesión en un turno
 * anterior o al cambiar de barista en el mismo equipo).
 *
 * Lo que se guarda en el dispositivo es el refresh token cifrado con AES-GCM
 * bajo una clave derivada del PIN (PBKDF2-SHA256). Sin el PIN el blob es
 * inservible; y como un PIN de 6 dígitos es corto, limitamos los intentos.
 */

const ITERACIONES = 210_000
const LONGITUD_PIN = 6
export const MAX_INTENTOS = 10

export interface SesionDesbloqueada {
  refreshToken: string
  nombre: string
  rol: Rol
}

export type ResultadoDesbloqueo =
  | { ok: true; sesion: SesionDesbloqueada }
  | { ok: false; motivo: 'sin-pin' }
  | { ok: false; motivo: 'pin-incorrecto'; intentosRestantes: number }
  | { ok: false; motivo: 'bloqueado' }

function bytesAleatorios(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

async function derivarClave(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: ITERACIONES, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export function pinEsValido(pin: string): boolean {
  return new RegExp(`^\\d{${LONGITUD_PIN}}$`).test(pin)
}

export async function tienePin(): Promise<boolean> {
  return (await offlineDb.sesionPin.get('actual')) !== undefined
}

/** Perfil asociado al PIN guardado, para saludar en la pantalla de desbloqueo. */
export async function perfilDelPin(): Promise<{ nombre: string; rol: Rol } | null> {
  const s = await offlineDb.sesionPin.get('actual')
  return s ? { nombre: s.nombre, rol: s.rol } : null
}

/** Cifra el refresh token con el PIN y lo deja listo para desbloquear offline. */
export async function configurarPin(pin: string, datos: SesionDesbloqueada): Promise<void> {
  if (!pinEsValido(pin)) throw new Error(`El PIN debe tener ${LONGITUD_PIN} dígitos`)

  const salt = bytesAleatorios(16)
  const iv = bytesAleatorios(12)
  const clave = await derivarClave(pin, salt)
  const cifrado = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    clave,
    new TextEncoder().encode(datos.refreshToken),
  )

  const registro: SesionPin = {
    id: 'actual',
    salt,
    iv,
    cifrado,
    nombre: datos.nombre,
    rol: datos.rol,
    intentosFallidos: 0,
    creadoEn: new Date().toISOString(),
  }
  await offlineDb.sesionPin.put(registro)
}

/**
 * Intenta descifrar la sesión con el PIN dado. AES-GCM está autenticado, así
 * que un PIN incorrecto hace fallar el descifrado: no hace falta guardar
 * ningún hash aparte para comprobarlo.
 */
export async function desbloquearConPin(pin: string): Promise<ResultadoDesbloqueo> {
  const s = await offlineDb.sesionPin.get('actual')
  if (!s) return { ok: false, motivo: 'sin-pin' }
  if (s.intentosFallidos >= MAX_INTENTOS) {
    await borrarPin()
    return { ok: false, motivo: 'bloqueado' }
  }

  try {
    const clave = await derivarClave(pin, s.salt)
    const plano = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: s.iv as unknown as BufferSource },
      clave,
      s.cifrado,
    )
    if (s.intentosFallidos > 0) {
      await offlineDb.sesionPin.update('actual', { intentosFallidos: 0 })
    }
    return {
      ok: true,
      sesion: {
        refreshToken: new TextDecoder().decode(plano),
        nombre: s.nombre,
        rol: s.rol,
      },
    }
  } catch {
    const fallos = s.intentosFallidos + 1
    if (fallos >= MAX_INTENTOS) {
      await borrarPin()
      return { ok: false, motivo: 'bloqueado' }
    }
    await offlineDb.sesionPin.update('actual', { intentosFallidos: fallos })
    return { ok: false, motivo: 'pin-incorrecto', intentosRestantes: MAX_INTENTOS - fallos }
  }
}

export async function borrarPin(): Promise<void> {
  await offlineDb.sesionPin.delete('actual')
}
