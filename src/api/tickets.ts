import { api } from './client'
import type {
  TicketResponse, CrearTicketRequest, CobrarTicketRequest, VentaResponse,
} from '../types/api'

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
