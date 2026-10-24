import { api } from './client'
import type { BaristaDTO } from '../types/api'

/**
 * PIN del usuario, guardado en el servidor como hash bcrypt. Es el mismo en
 * cualquier tablet o teléfono; el dispositivo solo lo necesita en claro una
 * vez, para cifrar con él la sesión local que permite entrar sin internet.
 */

/** Define o cambia el PIN propio. Pide la contraseña para confirmar identidad. */
export const definirPin = (password: string, pin: string) =>
  api.put<null>('/api/auth/pin', { password, pin })

/** Elimina el PIN propio: ese usuario dejará de poder entrar sin internet. */
export const quitarPin = (password: string) =>
  api.delete<null>('/api/auth/pin', { password })

/** Quienes pueden atender en caja: usuarios activos con PIN. */
export const listarBaristas = () =>
  api.get<BaristaDTO[]>('/api/auth/pin/baristas')

/**
 * Pasa la caja a otro barista con su PIN, sin cerrar la sesión del equipo.
 * Desde ahí las ventas y propinas quedan a su nombre.
 */
export const cambiarBarista = (usuarioId: number, pin: string) =>
  api.post<BaristaDTO>('/api/auth/pin/cambiar', { usuarioId, pin })

/** Un supervisor o admin autoriza con su PIN algo que el barista no puede solo. */
export const autorizarSupervisor = (usuarioId: number, pin: string) =>
  api.post<BaristaDTO>('/api/auth/pin/autorizar', { usuarioId, pin })

/** Comprueba contra el servidor que el PIN tecleado es el correcto. */
export const verificarPin = (pin: string) =>
  api.post<null>('/api/auth/pin/verificar', { pin })
