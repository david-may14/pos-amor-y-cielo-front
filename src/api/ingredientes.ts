import { api } from './client'
import type { Ingrediente, IngredienteRequest, SubrecetaDTO, SubrecetaRequest } from '../types/api'

export const listarIngredientes = () => api.get<Ingrediente[]>('/api/ingredientes')

export const stockBajo = () => api.get<Ingrediente[]>('/api/ingredientes/stock-bajo')

export const crearIngrediente = (data: IngredienteRequest) =>
  api.post<Ingrediente>('/api/ingredientes', data)

export const actualizarIngrediente = (id: number, data: IngredienteRequest) =>
  api.put<Ingrediente>(`/api/ingredientes/${id}`, data)

export const obtenerSubreceta = (id: number) =>
  api.get<SubrecetaDTO>(`/api/ingredientes/${id}/subreceta`)

export const guardarSubreceta = (id: number, data: SubrecetaRequest) =>
  api.put<SubrecetaDTO>(`/api/ingredientes/${id}/subreceta`, data)

export const eliminarSubreceta = (id: number) =>
  api.delete<void>(`/api/ingredientes/${id}/subreceta`)

export const producirIngrediente = (id: number, lotes: number) =>
  api.post<Ingrediente>(`/api/ingredientes/${id}/producir`, { lotes })
