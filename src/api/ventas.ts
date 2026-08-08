import { api } from './client'
import type {
  VentaResponse, ResumenDia, ResumenPeriodo, ItemRequest,
  MotivoAnulacion, AnulacionDTO,
} from '../types/api'

export const reportePeriodo = (desde: string, hasta: string) =>
  api.get<ResumenPeriodo>(`/api/ventas/reporte?desde=${desde}&hasta=${hasta}`)

export const listarVentas = (fecha?: string) =>
  api.get<VentaResponse[]>(`/api/ventas${fecha ? `?fecha=${fecha}` : ''}`)

export const detalleVenta = (id: number) =>
  api.get<VentaResponse>(`/api/ventas/${id}`)

export const resumenDia = (fecha?: string) =>
  api.get<ResumenDia>(`/api/ventas/resumen${fecha ? `?fecha=${fecha}` : ''}`)

/**
 * Anula una venta. El motivo es obligatorio desde que existe la bitácora:
 * anular mueve dinero, y sin registro la operación es indistinguible de
 * quedarse con el efectivo de una venta que "nunca ocurrió".
 */
export const anularVenta = (id: number, motivo: MotivoAnulacion, nota?: string) =>
  api.post<VentaResponse>(`/api/ventas/${id}/anular`, { motivo, nota: nota ?? null })

export const listarAnulaciones = (desde: string, hasta: string) =>
  api.get<AnulacionDTO[]>(`/api/ventas/anulaciones?desde=${desde}&hasta=${hasta}`)

export const crearVenta = (
  items: ItemRequest[],
  metodoPago: string,
  descuentoTicketId?: number | null,
  propina?: number,
  splitGrupo?: string | null,
  clientId?: string,
  ocurrioEn?: string,
) => api.post<VentaResponse>('/api/ventas', {
  items, metodoPago, descuentoTicketId, propina: propina ?? 0, splitGrupo: splitGrupo ?? null,
  ...(clientId ? { clientId } : {}),
  ...(ocurrioEn ? { ocurrioEn } : {}),
})
