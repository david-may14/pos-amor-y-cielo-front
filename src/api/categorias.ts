import { api } from './client'
import type { Categoria, CategoriaRequest } from '../types/api'

export const listarCategorias = () => api.get<Categoria[]>('/api/categorias')

export const crearCategoria = (data: CategoriaRequest) =>
  api.post<Categoria>('/api/categorias', data)

export const actualizarCategoria = (id: number, data: CategoriaRequest) =>
  api.put<Categoria>(`/api/categorias/${id}`, data)

export const eliminarCategoria = (id: number) =>
  api.delete<null>(`/api/categorias/${id}`)
