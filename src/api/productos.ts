import { api } from './client'
import type { ProductoDTO, ProductoRequest, RecetaLineaDTO, RecetaLineaRequest } from '../types/api'

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
