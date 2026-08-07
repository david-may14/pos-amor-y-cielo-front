import { api, descargarArchivo, subirArchivo } from './client'
import type { ProductoDTO, ProductoRequest, RecetaLineaDTO, RecetaLineaRequest, ModificadorGrupo, PlantillaDTO, ImportPreviewResult, ImportResult, CosteoDTO, CosteoResumenDTO } from '../types/api'

export const listarCosteo = () => api.get<CosteoResumenDTO[]>('/api/productos/costeo')
export const detalleCosteo = (id: number) => api.get<CosteoDTO>(`/api/productos/${id}/costeo`)

/**
 * Una tanda del catálogo con desglose e historial. Solo lo usa el reporte
 * imprimible.
 *
 * Va paginado porque el servidor corre con poca memoria: pedirlo entero de una
 * vez le dejaba pausas de recolección que frenaban TODAS las peticiones, no
 * solo esta. El reporte encadena tandas hasta juntar el catálogo.
 */
export const costeoCompletoPagina = (desde: number, limite = 25) =>
  api.get<CosteoDTO[]>(`/api/productos/costeo/completo?desde=${desde}&limite=${limite}`)

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
 * Sale de la copia local sin tocar la red: la precarga los baja todos al abrir
 * la app y al abrir turno, y no cambian a media venta. Solo va al servidor si
 * no hay copia — un producto creado después de la última precarga.
 */
export const listarModificadoresProductoOffline = (id: number) =>
  api.getCacheado<ModificadorGrupo[]>(`modificadores:${id}`, `/api/productos/${id}/modificadores`)

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
