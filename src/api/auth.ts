import { api } from './client'
import { etiquetaDispositivo, getRefreshToken } from './sesion'
import type { LoginRequest, LoginResponse } from '../types/api'

export const login = (data: LoginRequest) =>
  api.post<LoginResponse>('/api/auth/login', {
    ...data,
    dispositivo: data.dispositivo ?? etiquetaDispositivo(),
  })

/**
 * Revoca el refresh token de este dispositivo en el servidor. Si no hay red no
 * pasa nada: la sesión local se cierra igual y el token quedará huérfano hasta
 * que caduque o se revoque desde el panel.
 */
export async function revocarSesionRemota(): Promise<void> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return
  try {
    await api.post<null>('/api/auth/logout', { refreshToken })
  } catch {
    // sin conexión o servidor caído: cerrar sesión nunca debe fallar
  }
}
