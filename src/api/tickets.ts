import { api } from './client'
import type {
  TicketResponse, CrearTicketRequest, CobrarTicketRequest, VentaResponse,
  SincronizarTicketRequest,
} from '../types/api'

/**
 * Sube el estado completo de una comanda editada sin conexión. Idempotente por
 * clientId: reenviarla no duplica nada.
 */
export const sincronizarTicket = (req: SincronizarTicketRequest) =>
  api.put<TicketResponse>('/api/tickets/sync', req)

export const listarTickets = (estado: 'ABIERTO' | 'COBRADO' | 'CANCELADO' = 'ABIERTO') =>
  api.get<TicketResponse[]>(`/api/tickets?estado=${estado}`)

export const detalleTicket = (id: number) =>
  api.get<TicketResponse>(`/api/tickets/${id}`)

export const crearTicket = (req: CrearTicketRequest) =>
  api.post<TicketResponse>('/api/tickets', req)

export const actualizarTicket = (id: number, req: CrearTicketRequest) =>
  api.put<TicketResponse>(`/api/tickets/${id}`, req)

export const cobrarTicket = (id: number, req: CobrarTicketRequest) =>
  api.post<VentaResponse>(`/api/tickets/${id}/cobrar`, req)

export const cancelarTicket = (id: number) =>
  api.delete<TicketResponse>(`/api/tickets/${id}`)

export const historialTickets = (desde: string, hasta: string) =>
  api.get<TicketResponse[]>(`/api/tickets/historial?desde=${desde}&hasta=${hasta}`)
