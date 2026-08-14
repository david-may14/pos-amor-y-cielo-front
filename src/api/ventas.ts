import { api } from './client'
import type {
  VentaResponse, ResumenDia, ResumenPeriodo, ItemRequest,
  MotivoAnulacion, AnulacionDTO,
} from '../types/api'

export const reportePeriodo = (desde: string, hasta: string) =>
  api.get<ResumenPeriodo>(`/api/ventas/reporte?desde=${desde}&hasta=${hasta}`)

/**
 * Ventas de un rango de fechas, en la zona del negocio.
 *
 * Los días se cuentan en Mérida y no en UTC: la cafetería abre por la tarde y
 * las 18:00 de aquí son las 00:00 UTC, así que contando en UTC cada servicio
 * quedaba partido entre dos fechas.
 */
export const listarVentas = (desde?: string, hasta?: string) => {
  const q = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''
  return api.get<VentaResponse[]>(`/api/ventas${q}`)
}

export const detalleVenta = (id: number) =>
  api.get<VentaResponse>(`/api/ventas/${id}`)

/** El mismo resumen, sobre el rango. Las cuentas las hace el servidor: si se
 *  rehicieran aquí, dejarían de coincidir el día que cambie la fórmula. */
export const resumenDia = (desde?: string, hasta?: string) => {
  const q = desde && hasta ? `?desde=${desde}&hasta=${hasta}` : ''
  return api.get<ResumenDia>(`/api/ventas/resumen${q}`)
}

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
