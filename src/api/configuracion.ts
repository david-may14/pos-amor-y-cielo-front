import { api } from './client'
import type { ConfiguracionDTO, RecalculoDTO, RecalculoResultado } from '../types/api'

export const obtenerConfiguracion = () => api.get<ConfiguracionDTO>('/api/configuracion')

/**
 * Con desde/hasta, las ventas de esas fechas se recalculan con el IVA o la
 * comisión nuevos en el mismo paso; si eso falla, la configuración no cambia.
 */
export const actualizarConfiguracion = (data: ConfiguracionDTO & { desde?: string; hasta?: string }) =>
  api.put<ConfiguracionDTO>('/api/configuracion', data)

/** Aplica otro IVA o comisión a las ventas de unas fechas. Con aplicar=false solo dice el impacto. */
export const recalcularPeriodo = (data: {
  desde: string
  hasta: string
  ivaPorcentaje: number | null
  comisionTarjeta: number | null
  aplicar: boolean
}) => api.post<RecalculoResultado>('/api/configuracion/recalcular', data)

export const listarRecalculos = () => api.get<RecalculoDTO[]>('/api/configuracion/recalculos')
