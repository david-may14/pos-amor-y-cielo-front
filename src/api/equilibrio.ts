import { api } from './client'
import type { GastoFijoDTO, EquilibrioDTO } from '../types/api'

export const obtenerEquilibrio = () =>
  api.get<EquilibrioDTO>('/api/equilibrio/mes-actual')

export const listarGastos = () =>
  api.get<GastoFijoDTO[]>('/api/equilibrio/gastos')

export const crearGasto = (data: { nombre: string; monto: number }) =>
  api.post<GastoFijoDTO>('/api/equilibrio/gastos', data)

export const actualizarGasto = (id: number, data: { nombre: string; monto: number; activo: boolean }) =>
  api.put<GastoFijoDTO>(`/api/equilibrio/gastos/${id}`, data)

export const eliminarGasto = (id: number) =>
  api.delete<void>(`/api/equilibrio/gastos/${id}`)
