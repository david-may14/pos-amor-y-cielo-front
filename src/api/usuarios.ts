import { api } from './client'
import type {
  UsuarioDTO,
  CrearUsuarioRequest,
  ActualizarUsuarioRequest,
  CambiarPasswordRequest,
} from '../types/api'

export const listarUsuarios = () => api.get<UsuarioDTO[]>('/api/usuarios')

export const crearUsuario = (data: CrearUsuarioRequest) =>
  api.post<UsuarioDTO>('/api/usuarios', data)

export const actualizarUsuario = (id: number, data: ActualizarUsuarioRequest) =>
  api.put<UsuarioDTO>(`/api/usuarios/${id}`, data)

export const desactivarUsuario = (id: number) =>
  api.delete<null>(`/api/usuarios/${id}`)

export const cambiarPassword = (id: number, data: CambiarPasswordRequest) =>
  api.patch<null>(`/api/usuarios/${id}/password`, data)
