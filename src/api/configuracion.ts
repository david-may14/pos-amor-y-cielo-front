import { api } from './client'
import type { ConfiguracionDTO } from '../types/api'

export const obtenerConfiguracion = () => api.get<ConfiguracionDTO>('/api/configuracion')

export const actualizarConfiguracion = (data: ConfiguracionDTO) =>
  api.put<ConfiguracionDTO>('/api/configuracion', data)
