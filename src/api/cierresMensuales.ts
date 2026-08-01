import { api } from './client'
import type { CierreMensualDTO } from '../types/api'

export async function obtenerCierreMensual(anio: number, mes: number): Promise<CierreMensualDTO | null> {
  try {
    return await api.get<CierreMensualDTO>(`/api/cierres-mensuales/${anio}/${mes}`)
  } catch {
    return null
  }
}

export const previsualizarCierreMensual = (anio: number, mes: number) =>
  api.get<CierreMensualDTO>(`/api/cierres-mensuales/preview?anio=${anio}&mes=${mes}`)

export const listarCierresMensuales = () => api.get<CierreMensualDTO[]>('/api/cierres-mensuales')

export const cerrarMes = (anio: number, mes: number, notas?: string) =>
  api.post<CierreMensualDTO>('/api/cierres-mensuales', { anio, mes, notas })
