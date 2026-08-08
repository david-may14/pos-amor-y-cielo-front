import { api, descargarArchivo, subirArchivo } from './client'
import type { Ingrediente, IngredienteBasico, IngredienteRequest, AlertaStockDTO, SubrecetaDTO, SubrecetaRequest, IngredientePrecioDTO, AgregarPrecioRequest, IngPreviewResult, IngImportResult } from '../types/api'

/** Listado sin costos, para quien no es admin. */
export const listarIngredientesBasico = () =>
  api.get<IngredienteBasico[]>('/api/ingredientes/basico')

export const listarIngredientes = () => api.get<Ingrediente[]>('/api/ingredientes')

export const stockBajo = () => api.get<Ingrediente[]>('/api/ingredientes/stock-bajo')

export const alertasStock = () => api.get<AlertaStockDTO[]>('/api/ingredientes/alertas-stock')

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

export const listarPrecios = (id: number) =>
  api.get<IngredientePrecioDTO[]>(`/api/ingredientes/${id}/precios`)

export const agregarPrecio = (id: number, data: AgregarPrecioRequest) =>
  api.post<IngredientePrecioDTO>(`/api/ingredientes/${id}/precios`, data)

export const desactivarPrecio = (ingredienteId: number, precioId: number) =>
  api.patch<void>(`/api/ingredientes/${ingredienteId}/precios/${precioId}/desactivar`, {})

export const exportarIngredientes = (): Promise<void> =>
  descargarArchivo('/api/ingredientes/export', 'ingredientes.csv')

export const previewImportIngredientes = (file: File): Promise<IngPreviewResult> =>
  subirArchivo<IngPreviewResult>('/api/ingredientes/import/preview', file)

export const confirmarImportIngredientes = (file: File): Promise<IngImportResult> =>
  subirArchivo<IngImportResult>('/api/ingredientes/import/confirmar', file)
