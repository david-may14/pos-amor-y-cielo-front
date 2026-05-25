import { api } from './client'
import type { VentaResponse, ResumenDia, ItemRequest } from '../types/api'

export const listarVentas = (fecha?: string) =>
  api.get<VentaResponse[]>(`/api/ventas${fecha ? `?fecha=${fecha}` : ''}`)

export const detalleVenta = (id: number) =>
  api.get<VentaResponse>(`/api/ventas/${id}`)

export const resumenDia = (fecha?: string) =>
  api.get<ResumenDia>(`/api/ventas/resumen${fecha ? `?fecha=${fecha}` : ''}`)

export const crearVenta = (items: ItemRequest[], metodoPago: string) =>
  api.post<VentaResponse>('/api/ventas', { items, metodoPago })
