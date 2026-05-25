// ─── Roles ────────────────────────────────────────────────────────────────────
export type Rol = 'ADMIN' | 'BARISTA'
export type TipoAjuste = 'MERMA' | 'AJUSTE'
export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
}
export interface LoginResponse {
  token: string
  nombre: string
  rol: Rol
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────
export interface UsuarioDTO {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  creadoEn: string
}
export interface CrearUsuarioRequest {
  nombre: string
  email: string
  password: string
  rol: Rol
}
export interface ActualizarUsuarioRequest {
  nombre: string
  email: string
  rol: Rol
}
export interface CambiarPasswordRequest {
  passwordActual?: string
  passwordNueva: string
}

// ─── Categorías ───────────────────────────────────────────────────────────────
export interface Categoria {
  id: number
  nombre: string
  orden: number
}
export interface CategoriaRequest {
  nombre: string
  orden?: number
}

// ─── Productos ────────────────────────────────────────────────────────────────
export interface ProductoDTO {
  id: number
  nombre: string
  precioVenta: number
  categoria: string
}
export interface ProductoRequest {
  nombre: string
  precioVenta: number
  categoriaId?: number
}

// ─── Receta ───────────────────────────────────────────────────────────────────
export interface RecetaLineaDTO {
  id: number
  ingredienteId: number
  ingredienteNombre: string
  unidad: string
  cantidad: number
}
export interface RecetaLineaRequest {
  ingredienteId: number
  cantidad: number
}

// ─── Ingredientes ─────────────────────────────────────────────────────────────
export interface Ingrediente {
  id: number
  nombre: string
  unidad: string
  stockActual: number
  stockMinimo: number
  costoUnitario: number
  actualizadoEn: string
}
export interface IngredienteRequest {
  nombre: string
  unidad: string
  stockMinimo: number
  costoUnitario: number
}

// ─── Inventario ───────────────────────────────────────────────────────────────
export interface MovimientoInventario {
  id: number
  ingredienteId: number
  tipo: string
  cantidad: number
  ventaId: number | null
  nota: string | null
  creadoEn: string
}
export interface LineaCompraRequest {
  ingredienteId: number
  cantidad: number
  nota?: string
}
export interface AjusteRequest {
  ingredienteId: number
  cantidad: number
  tipo: TipoAjuste
  nota?: string
}

// ─── Ventas ───────────────────────────────────────────────────────────────────
export interface ItemRequest {
  productoId: number
  cantidad: number
  notas?: string
}
export interface ItemResponse {
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  costoUnitario: number
  notas: string | null
}
export interface VentaResponse {
  id: number
  total: number
  costoTotal: number
  metodoPago: string
  creadaEn: string
  items: ItemResponse[]
}
export interface ResumenDia {
  fecha: string
  totalVentas: number
  ingresos: number
  costos: number
  utilidad: number
  ventasPorMetodoPago: Record<string, number>
}
