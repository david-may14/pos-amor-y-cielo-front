import { api } from './client'
import type { CierreMensualDTO } from '../types/api'

interface EstadoCierre { pendiente: boolean; anio: number | null; mes: number | null }

/**
 * Qué mes falta por cerrar, si alguno.
 *
 * Lo decide el servidor: la regla —cuál es el mes objetivo, y si tuvo ventas—
 * estaba escrita aquí y en el aviso por correo, y solo una de las copias se
 * corregía cuando algo fallaba. Un mes sin ventas no está pendiente: no hay
 * nada que cuadrar.
 */
export async function mesPendienteDeCerrar(): Promise<{ anio: number; mes: number } | null> {
  const e = await api.get<EstadoCierre>('/api/cierres-mensuales/pendiente')
  return e.pendiente && e.anio && e.mes ? { anio: e.anio, mes: e.mes } : null
}

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
