import { api, descargarArchivo, subirArchivo } from './client'
import type { ProductoDTO, ProductoRequest, RecetaLineaDTO, RecetaLineaRequest, ModificadorGrupo, PlantillaDTO, ImportPreviewResult, ImportResult, CosteoDTO, CosteoResumenDTO } from '../types/api'

export const listarCosteo = () => api.get<CosteoResumenDTO[]>('/api/productos/costeo')
export const detalleCosteo = (id: number) => api.get<CosteoDTO>(`/api/productos/${id}/costeo`)

export const listarProductos = () => api.get<ProductoDTO[]>('/api/productos')

/** Para la caja (POSPage): cachea el catálogo para poder vender sin conexión. */
export const listarProductosOffline = () =>
  api.getCached<ProductoDTO[]>('productos', '/api/productos')

export const crearProducto = (data: ProductoRequest) =>
  api.post<ProductoDTO>('/api/productos', data)

export const actualizarProducto = (id: number, data: ProductoRequest) =>
  api.put<ProductoDTO>(`/api/productos/${id}`, data)

export const eliminarProducto = (id: number) =>
  api.delete<null>(`/api/productos/${id}`)

export const obtenerReceta = (id: number) =>
  api.get<RecetaLineaDTO[]>(`/api/productos/${id}/receta`)

export const reemplazarReceta = (id: number, lineas: RecetaLineaRequest[]) =>
  api.put<RecetaLineaDTO[]>(`/api/productos/${id}/receta`, lineas)

export const listarModificadoresProducto = (id: number) =>
  api.get<ModificadorGrupo[]>(`/api/productos/${id}/modificadores`)

/**
 * Responde con la copia local y refresca por detrás: se consulta en cada toque
 * de producto durante una venta, así que esperar a la red ahí se paga con el
 * cliente enfrente. La primera vez que se toca un producto sí espera.
 */
export const listarModificadoresProductoOffline = (id: number) =>
  api.getCachedFirst<ModificadorGrupo[]>(`modificadores:${id}`, `/api/productos/${id}/modificadores`)

export const asignarModificador = (productoId: number, grupoId: number) =>
  api.post<null>(`/api/productos/${productoId}/modificadores/${grupoId}`, {})

export const quitarModificador = (productoId: number, grupoId: number) =>
  api.delete<null>(`/api/productos/${productoId}/modificadores/${grupoId}`)

export const toggleDisponibilidad = (id: number) =>
  api.patch<ProductoDTO>(`/api/productos/${id}/disponibilidad`, {})

export const actualizarMargenSeguridad = (id: number, margenSeguridad: number | null) =>
  api.patch<ProductoDTO>(`/api/productos/${id}/margen-seguridad`, { margenSeguridad })

export const actualizarPrecioProducto = (id: number, precioVenta: number) =>
  api.patch<ProductoDTO>(`/api/productos/${id}/precio`, { precioVenta })

export const listarPlantillasProducto = (id: number) =>
  api.get<PlantillaDTO[]>(`/api/productos/${id}/plantillas`)

export const asignarPlantillasProducto = (id: number, plantillaIds: number[]) =>
  api.put<PlantillaDTO[]>(`/api/productos/${id}/plantillas`, plantillaIds)

export const exportarProductos = (): Promise<void> =>
  descargarArchivo(
    '/api/productos/export',
    `productos-${new Date().toISOString().slice(0, 10)}.csv`,
  )

export const previewImport = (file: File): Promise<ImportPreviewResult> =>
  subirArchivo<ImportPreviewResult>('/api/productos/import/preview', file)

export const confirmarImport = (file: File): Promise<ImportResult> =>
  subirArchivo<ImportResult>('/api/productos/import/confirmar', file)
