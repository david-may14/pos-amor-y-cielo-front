import { api } from './client'
import type { VentaResponse, ResumenDia, ResumenPeriodo, ItemRequest } from '../types/api'

export const reportePeriodo = (desde: string, hasta: string) =>
  api.get<ResumenPeriodo>(`/api/ventas/reporte?desde=${desde}&hasta=${hasta}`)

export const listarVentas = (fecha?: string) =>
  api.get<VentaResponse[]>(`/api/ventas${fecha ? `?fecha=${fecha}` : ''}`)

export const detalleVenta = (id: number) =>
  api.get<VentaResponse>(`/api/ventas/${id}`)

export const resumenDia = (fecha?: string) =>
  api.get<ResumenDia>(`/api/ventas/resumen${fecha ? `?fecha=${fecha}` : ''}`)

export const anularVenta = (id: number) =>
  api.post<VentaResponse>(`/api/ventas/${id}/anular`, {})

export const crearVenta = (
  items: ItemRequest[],
  metodoPago: string,
  descuentoTicketId?: number | null,
  propina?: number,
  splitGrupo?: string | null,
) => api.post<VentaResponse>('/api/ventas', { items, metodoPago, descuentoTicketId, propina: propina ?? 0, splitGrupo: splitGrupo ?? null })
