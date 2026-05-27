import { api } from './client'
import type { DescuentoView, DescuentoRequest } from '../types/api'

export const listarDescuentos = () =>
  api.get<DescuentoView[]>('/api/descuentos')

export const crearDescuento = (data: DescuentoRequest) =>
  api.post<DescuentoView>('/api/descuentos', data)

export const actualizarDescuento = (id: number, data: DescuentoRequest) =>
  api.put<DescuentoView>(`/api/descuentos/${id}`, data)

export const eliminarDescuento = (id: number) =>
  api.delete<null>(`/api/descuentos/${id}`)

export const asignarCategoria = (id: number, catId: number) =>
  api.post<null>(`/api/descuentos/${id}/categorias/${catId}`, {})

export const quitarCategoria = (id: number, catId: number) =>
  api.delete<null>(`/api/descuentos/${id}/categorias/${catId}`)

export const asignarProducto = (id: number, prodId: number) =>
  api.post<null>(`/api/descuentos/${id}/productos/${prodId}`, {})

export const quitarProducto = (id: number, prodId: number) =>
  api.delete<null>(`/api/descuentos/${id}/productos/${prodId}`)

export const getDescuentoAplicable = (productoId: number) =>
  api.get<DescuentoView | null>(`/api/descuentos/aplicable/producto/${productoId}`)

export const listarDescuentosTicket = () =>
  api.get<DescuentoView[]>('/api/descuentos/ticket-activos')
