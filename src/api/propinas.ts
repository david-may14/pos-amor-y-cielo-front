import { api } from './client'
import type { PagarPropinaRequest, PropinaPagoDTO, ResumenPropinasDTO } from '../types/api'

/** Por barista: lo ganado y pagado en el periodo, y lo que se le debe hoy. */
export const resumenPropinas = (desde: string, hasta: string) =>
  api.get<ResumenPropinasDTO>(`/api/propinas/resumen?desde=${desde}&hasta=${hasta}`)

export const listarPagosPropina = (desde: string, hasta: string) =>
  api.get<PropinaPagoDTO[]>(`/api/propinas/pagos?desde=${desde}&hasta=${hasta}`)

/** Si sale del cajón, el servidor lo anota también como salida del turno abierto. */
export const pagarPropina = (req: PagarPropinaRequest) =>
  api.post<PropinaPagoDTO>('/api/propinas/pagos', req)
