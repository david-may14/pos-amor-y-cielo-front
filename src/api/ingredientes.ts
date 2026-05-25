import { api } from './client'
import type { Ingrediente, IngredienteRequest } from '../types/api'

export const listarIngredientes = () => api.get<Ingrediente[]>('/api/ingredientes')

export const stockBajo = () => api.get<Ingrediente[]>('/api/ingredientes/stock-bajo')

export const crearIngrediente = (data: IngredienteRequest) =>
  api.post<Ingrediente>('/api/ingredientes', data)

export const actualizarIngrediente = (id: number, data: IngredienteRequest) =>
  api.put<Ingrediente>(`/api/ingredientes/${id}`, data)
