import { api } from './client'
import type { ModificadorGrupo, GrupoRequest, ModificadorOpcion, OpcionRequest } from '../types/api'

export const listarModificadores = () => api.get<ModificadorGrupo[]>('/api/modificadores')

export const crearModificador = (data: GrupoRequest) =>
  api.post<ModificadorGrupo>('/api/modificadores', data)

export const actualizarModificador = (id: number, data: GrupoRequest) =>
  api.put<ModificadorGrupo>(`/api/modificadores/${id}`, data)

export const eliminarModificador = (id: number) =>
  api.delete<null>(`/api/modificadores/${id}`)

export const agregarOpcion = (grupoId: number, data: OpcionRequest) =>
  api.post<ModificadorOpcion>(`/api/modificadores/${grupoId}/opciones`, data)

export const actualizarOpcion = (opcionId: number, data: OpcionRequest) =>
  api.put<ModificadorOpcion>(`/api/modificadores/opciones/${opcionId}`, data)

export const eliminarOpcion = (opcionId: number) =>
  api.delete<null>(`/api/modificadores/opciones/${opcionId}`)
