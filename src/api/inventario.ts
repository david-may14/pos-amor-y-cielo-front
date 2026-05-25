import { api } from './client'
import type { MovimientoInventario, LineaCompraRequest, AjusteRequest } from '../types/api'

export const listarMovimientos = (ingredienteId?: number) =>
  api.get<MovimientoInventario[]>(
    `/api/inventario/movimientos${ingredienteId ? `?ingredienteId=${ingredienteId}` : ''}`
  )

export const registrarCompra = (lineas: LineaCompraRequest[]) =>
  api.post<MovimientoInventario[]>('/api/inventario/compras', { lineas })

export const registrarAjuste = (data: AjusteRequest) =>
  api.post<MovimientoInventario>('/api/inventario/ajustes', data)
