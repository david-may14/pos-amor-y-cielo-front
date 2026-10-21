import { api } from './client'
import type { ConfiguracionDTO, RecalculoDTO, RecalculoResultado } from '../types/api'

export const obtenerConfiguracion = () => api.get<ConfiguracionDTO>('/api/configuracion')

export const actualizarConfiguracion = (data: ConfiguracionDTO) =>
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
