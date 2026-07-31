import { api } from './client'

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

/** Comprueba contra el servidor que el PIN tecleado es el correcto. */
export const verificarPin = (pin: string) =>
  api.post<null>('/api/auth/pin/verificar', { pin })
