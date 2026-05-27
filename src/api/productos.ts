import { api } from './client'
import type { ProductoDTO, ProductoRequest, RecetaLineaDTO, RecetaLineaRequest, ModificadorGrupo } from '../types/api'

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
