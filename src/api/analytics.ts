import { api } from './client'

export interface ResumenVentas {
  kpis: {
    ventasBrutas: number
    reembolsos: number
    descuentos: number
    ventasNetas: number
    beneficioBruto: number
    margen: number
  }
  datos: Array<{
    fecha: string
    ventasBrutas: number
    reembolsos: number
    descuentos: number
    ventasNetas: number
    beneficioBruto: number
    transacciones: number
  }>
}

export interface ProductoVentas {
  top5: Array<{
    id: number
    nombre: string
    categoria: string
    cantidad: number
    ventasNetas: number
    costoTotal: number
    beneficioBruto: number
  }>
  datos: Array<{
    fecha: string
    productos: Array<{
      productoId: number
      nombreProducto: string
      cantidad: number
    }>
  }>
}

export interface CategoriaVentas {
  datos: Array<{
    id: number
    nombre: string
    articulosVendidos: number
    ventasNetas: number
    costoTotal: number
    beneficioBruto: number
    margen: number
  }>
}

export interface UsuarioVentas {
  datos: Array<{
    id: number
    nombre: string
    ventasBrutas: number
    reembolsos: number
    descuentos: number
    ventasNetas: number
    recibos: number
    ventaPromedio: number
  }>
}

export interface MetodoPagoVentas {
  datos: Array<{
    tipo: string
    transacciones: number
    importe: number
    reembolsos: number
    montoNeto: number
  }>
}

export interface Recibos {
  resumen: {
    totalRecibos: number
    ventas: number
    reembolsos: number
  }
  recibos: Array<{
    id: number
    fecha: string
    empleado: string
    cliente: string
    tipo: string
    total: number
  }>
}

export const obtenerResumen = (desde: string, hasta: string) =>
  api.get<ResumenVentas>(`/api/analytics/resumen?desde=${desde}&hasta=${hasta}`)

export const obtenerProductos = (desde: string, hasta: string) =>
  api.get<ProductoVentas>(`/api/analytics/productos?desde=${desde}&hasta=${hasta}`)

export const obtenerCategorias = (desde: string, hasta: string) =>
  api.get<CategoriaVentas>(`/api/analytics/categorias?desde=${desde}&hasta=${hasta}`)

export const obtenerUsuarios = (desde: string, hasta: string) =>
  api.get<UsuarioVentas>(`/api/analytics/usuarios?desde=${desde}&hasta=${hasta}`)

export const obtenerMetodosPago = (desde: string, hasta: string) =>
  api.get<MetodoPagoVentas>(`/api/analytics/metodos-pago?desde=${desde}&hasta=${hasta}`)

export const obtenerRecibos = (desde: string, hasta: string) =>
  api.get<Recibos>(`/api/analytics/recibos?desde=${desde}&hasta=${hasta}`)
