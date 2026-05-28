import { api } from './client'
import type { ProductoDTO, ProductoRequest, RecetaLineaDTO, RecetaLineaRequest, ModificadorGrupo, PlantillaDTO, ImportPreviewResult, ImportResult } from '../types/api'

export const listarProductos = () => api.get<ProductoDTO[]>('/api/productos')

export const crearProducto = (data: ProductoRequest) =>
  api.post<ProductoDTO>('/api/productos', data)

export const actualizarProducto = (id: number, data: ProductoRequest) =>
  api.put<ProductoDTO>(`/api/productos/${id}`, data)

export const eliminarProducto = (id: number) =>
  api.delete<null>(`/api/productos/${id}`)

export const obtenerReceta = (id: number) =>
  api.get<RecetaLineaDTO[]>(`/api/productos/${id}/receta`)

export const reemplazarReceta = (id: number, lineas: RecetaLineaRequest[]) =>
  api.put<RecetaLineaDTO[]>(`/api/productos/${id}/receta`, lineas)

export const listarModificadoresProducto = (id: number) =>
  api.get<ModificadorGrupo[]>(`/api/productos/${id}/modificadores`)

export const asignarModificador = (productoId: number, grupoId: number) =>
  api.post<null>(`/api/productos/${productoId}/modificadores/${grupoId}`, {})

export const quitarModificador = (productoId: number, grupoId: number) =>
  api.delete<null>(`/api/productos/${productoId}/modificadores/${grupoId}`)

export const toggleDisponibilidad = (id: number) =>
  api.patch<ProductoDTO>(`/api/productos/${id}/disponibilidad`, {})

export const listarPlantillasProducto = (id: number) =>
  api.get<PlantillaDTO[]>(`/api/productos/${id}/plantillas`)

export const asignarPlantillasProducto = (id: number, plantillaIds: number[]) =>
  api.put<PlantillaDTO[]>(`/api/productos/${id}/plantillas`, plantillaIds)

export const exportarProductos = async (): Promise<void> => {
  const BASE_URL = 'http://localhost:8080'
  const token = localStorage.getItem('pos_token')
  const res = await fetch(`${BASE_URL}/api/productos/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error('Error al exportar')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `productos-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export const previewImport = (file: File): Promise<ImportPreviewResult> => {
  const form = new FormData()
  form.append('file', file)
  const BASE_URL = 'http://localhost:8080'
  const token = localStorage.getItem('pos_token')
  return fetch(`${BASE_URL}/api/productos/import/preview`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  })
}

export const confirmarImport = (file: File): Promise<ImportResult> => {
  const form = new FormData()
  form.append('file', file)
  const BASE_URL = 'http://localhost:8080'
  const token = localStorage.getItem('pos_token')
  return fetch(`${BASE_URL}/api/productos/import/confirmar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  }).then(async (r) => {
    if (!r.ok) throw new Error(await r.text())
    return r.json()
  })
}
