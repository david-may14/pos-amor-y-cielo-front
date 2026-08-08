import { api } from './client'
import type {
  CompraDTO, CompraRequest, ExtraccionTicket, ResumenCompras,
} from '../types/api'

export const listarCompras = (desde: string, hasta: string) =>
  api.get<CompraDTO[]>(`/api/compras?desde=${desde}&hasta=${hasta}`)

export const resumenCompras = (desde: string, hasta: string) =>
  api.get<ResumenCompras>(`/api/compras/resumen?desde=${desde}&hasta=${hasta}`)

export const crearCompra = (req: CompraRequest) =>
  api.post<CompraDTO>('/api/compras', req)

export const eliminarCompra = (id: number) =>
  api.delete<null>(`/api/compras/${id}`)

/** ¿Está configurada la llave? Si no, la app no ofrece la cámara. */
export const extraccionDisponible = () =>
  api.get<{ disponible: boolean }>('/api/compras/extraccion-disponible')

/**
 * Lee la foto y devuelve una PROPUESTA — no guarda nada. La foto viaja en
 * base64 y el servidor no la almacena: se usa para leerla y se descarta.
 */
export const extraerTicket = (base64: string, tipoMime: string) =>
  api.post<ExtraccionTicket>('/api/compras/extraer', { fotoBase64: base64, tipoMime })
