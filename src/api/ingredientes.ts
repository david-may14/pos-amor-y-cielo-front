import { api } from './client'
import type { Ingrediente, IngredienteRequest, SubrecetaDTO, SubrecetaRequest, IngredientePrecioDTO, AgregarPrecioRequest, IngPreviewResult, IngImportResult } from '../types/api'

export const listarIngredientes = () => api.get<Ingrediente[]>('/api/ingredientes')

export const stockBajo = () => api.get<Ingrediente[]>('/api/ingredientes/stock-bajo')

export const crearIngrediente = (data: IngredienteRequest) =>
  api.post<Ingrediente>('/api/ingredientes', data)

export const actualizarIngrediente = (id: number, data: IngredienteRequest) =>
  api.put<Ingrediente>(`/api/ingredientes/${id}`, data)

export const obtenerSubreceta = (id: number) =>
  api.get<SubrecetaDTO>(`/api/ingredientes/${id}/subreceta`)

export const guardarSubreceta = (id: number, data: SubrecetaRequest) =>
  api.put<SubrecetaDTO>(`/api/ingredientes/${id}/subreceta`, data)

export const eliminarSubreceta = (id: number) =>
  api.delete<void>(`/api/ingredientes/${id}/subreceta`)

export const producirIngrediente = (id: number, lotes: number) =>
  api.post<Ingrediente>(`/api/ingredientes/${id}/producir`, { lotes })

export const listarPrecios = (id: number) =>
  api.get<IngredientePrecioDTO[]>(`/api/ingredientes/${id}/precios`)

export const agregarPrecio = (id: number, data: AgregarPrecioRequest) =>
  api.post<IngredientePrecioDTO>(`/api/ingredientes/${id}/precios`, data)

export const desactivarPrecio = (ingredienteId: number, precioId: number) =>
  api.patch<void>(`/api/ingredientes/${ingredienteId}/precios/${precioId}/desactivar`, {})

const BASE_URL = 'http://localhost:8080'
const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('pos_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const previewImportIngredientes = (file: File): Promise<IngPreviewResult> => {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE_URL}/api/ingredientes/import/preview`, {
    method: 'POST', headers: authHeaders(), body: form,
  }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json() })
}

export const confirmarImportIngredientes = (file: File): Promise<IngImportResult> => {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE_URL}/api/ingredientes/import/confirmar`, {
    method: 'POST', headers: authHeaders(), body: form,
  }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json() })
}
