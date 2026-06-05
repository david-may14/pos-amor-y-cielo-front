import { api } from './client'
import type { PlantillaDTO } from '../types/api'

export const listarPlantillas = () =>
  api.get<PlantillaDTO[]>('/api/plantillas')

export const crearPlantilla = (data: { nombre: string }) =>
  api.post<PlantillaDTO>('/api/plantillas', data)

export const actualizarPlantilla = (id: number, data: { nombre: string }) =>
  api.put<PlantillaDTO>(`/api/plantillas/${id}`, data)

export const toggleActivoPlantilla = (id: number) =>
  api.patch<PlantillaDTO>(`/api/plantillas/${id}/activo`, {})

export const eliminarPlantilla = (id: number) =>
  api.delete<null>(`/api/plantillas/${id}`)

export const duplicarPlantilla = (id: number, nombre: string) =>
  api.post<PlantillaDTO>(`/api/plantillas/${id}/duplicar`, { nombre })

export const reemplazarIngredientes = (
  id: number,
  lineas: { ingredienteId: number; cantidad: number }[]
) => api.put<PlantillaDTO>(`/api/plantillas/${id}/ingredientes`, lineas)
