// ─── Roles ────────────────────────────────────────────────────────────────────
export type Rol = 'ADMIN' | 'BARISTA'
export type TipoAjuste = 'MERMA' | 'AJUSTE'
export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface LoginRequest {
  email: string
  password: string
  /** Etiqueta del equipo, para poder revocarlo desde el servidor. */
  dispositivo?: string
}
export interface LoginResponse {
  token: string
  /** Token de larga duración con el que se renueva el access token. */
  refreshToken: string
  nombre: string
  rol: Rol
  /** Si el usuario ya definió un PIN (vive en el servidor, no en el dispositivo). */
  tienePin: boolean
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
  handle: string
  nombre: string
  precioVenta: number
  costo: number
  categoria: string
  disponible: boolean
  tieneReceta: boolean
  recetaVencida: boolean
  recetaRevisadaEn: string | null
  margenSeguridad: number | null
}
export interface ProductoRequest {
  nombre: string
  precioVenta: number
  costo?: number
  categoriaId?: number
  margenSeguridad?: number | null
}

// ─── Costeo ───────────────────────────────────────────────────────────────────
export interface LineaCosteo {
  nombre: string
  unidad: string
  cantidad: number
  mermaPorcentaje: number
  costoUnitario: number
  costoLinea: number
}
export interface PlantillaCosteo {
  nombre: string
  ingredientes: LineaCosteo[]
  costoPlantilla: number
}
export interface SnapshotCosteo {
  fecha: string
  costoTotal: number
  precioVenta: number
}
export interface CosteoDTO {
  productoId: number
  nombre: string
  categoria: string | null
  precioVenta: number
  costoTotal: number
  margen: number
  margenPorcentaje: number
  margenSeguridad: number | null
  costoConMargen: number | null
  ingredientesDirectos: LineaCosteo[]
  plantillas: PlantillaCosteo[]
  historial: SnapshotCosteo[]
}

// ─── Import/Export ────────────────────────────────────────────────────────────
export interface ImportCambio { campo: string; antes: string; despues: string }
export interface ImportFilaCrear { handle: string; nombre: string; categoria: string; precio: number; costo: number; disponible: boolean }
export interface ImportFilaActualizar { handle: string; nombre: string; cambios: ImportCambio[] }
export interface ImportFilaEliminar { handle: string; nombre: string }
export interface ImportFilaError { fila: number; mensaje: string }
export interface ImportPreviewResult {
  aCrear: ImportFilaCrear[]
  aActualizar: ImportFilaActualizar[]
  aEliminar: ImportFilaEliminar[]
  categoriasNuevas: string[]
  errores: ImportFilaError[]
}
export interface ImportResult {
  creados: number
  actualizados: number
  eliminados: number
  categoriasNuevas: number
}

// ─── Receta ───────────────────────────────────────────────────────────────────
export interface RecetaLineaDTO {
  id: number
  ingredienteId: number
  ingredienteNombre: string
  unidad: string
  cantidad: number
  mermaPorcentaje: number
}
export interface RecetaLineaRequest {
  ingredienteId: number
  cantidad: number
  mermaPorcentaje: number
}

// ─── Ingredientes ─────────────────────────────────────────────────────────────
export interface Ingrediente {
  id: number
  nombre: string
  unidad: string
  stockActual: number
  stockMinimo: number
  costoUnitario: number
  margenSeguridad: number | null
  rendimientoLote: number | null
  marca?: string | null
  proveedor?: string | null
  grupo?: string | null
  presentacion?: string | null
  formatoCompra?: number | null
  actualizadoEn: string
}
export interface IngredienteRequest {
  nombre: string
  unidad: string
  stockMinimo: number
  costoUnitario: number
  stockInicial?: number
  margenSeguridad?: number | null
}
export interface AlertaStockDTO {
  id: number
  nombre: string
  unidad: string
  stockActual: number
  stockMinimo: number
  margenSeguridad: number | null
  umbralSeguridad: number
  nivel: 'CRITICO' | 'ADVERTENCIA'
}
export interface IngredientePrecioDTO {
  id: number
  proveedor: string | null
  precioTotal: number
  cantidad: number
  precioUnitario: number
  fecha: string
  activo: boolean
}
export interface AgregarPrecioRequest {
  proveedor?: string
  precioTotal: number
  cantidad: number
}

// ─── Import Ingredientes ──────────────────────────────────────────────────────
export interface IngPrecioRow { proveedor: string | null; precioTotal: number; cantidad: number; precioUnitario: number }
export interface IngCambioMeta { campo: string; antes: string | null; despues: string }
export interface IngFilaCrear { nombre: string; unidad: string; marca: string | null; proveedor: string | null; grupo: string | null; costoUnitario: number; precios: IngPrecioRow[] }
export interface IngFilaActualizar { nombre: string; cambiosMeta: IngCambioMeta[]; preciosNuevos: IngPrecioRow[] }
export interface IngPreviewResult {
  aCrear: IngFilaCrear[]
  aActualizar: IngFilaActualizar[]
  errores: { fila: number; mensaje: string }[]
}
export interface IngImportResult { creados: number; actualizados: number; preciosAgregados: number }

// ─── Sub-recetas ──────────────────────────────────────────────────────────────
export interface SubrecetaLineaDTO {
  id: number
  baseId: number
  baseNombre: string
  baseUnidad: string
  cantidad: number
  mermaPorcentaje: number
}
export interface SubrecetaDTO {
  rendimientoLote: number | null
  unidad: string
  lineas: SubrecetaLineaDTO[]
}
export interface SubrecetaLineaRequest {
  baseId: number
  cantidad: number
  mermaPorcentaje: number
}
export interface SubrecetaRequest {
  rendimientoLote: number
  lineas: SubrecetaLineaRequest[]
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

// ─── Modificadores ────────────────────────────────────────────────────────────
export interface ModificadorOpcion {
  id: number
  nombre: string
  precioExtra: number
  activo: boolean
  ingrediente: Ingrediente | null
  cantidad: number | null
}
export interface ModificadorGrupo {
  id: number
  nombre: string
  seleccionMin: number
  seleccionMax: number | null
  activo: boolean
  creadoEn: string
  opciones: ModificadorOpcion[]
}
export interface GrupoRequest {
  nombre: string
  seleccionMin?: number
  seleccionMax?: number | null
  opciones?: OpcionRequest[]
}
export interface OpcionRequest {
  nombre: string
  precioExtra: number
  ingredienteId?: number | null
  cantidad?: number | null
}
export interface ModificadorResponse {
  nombre: string
  precioExtra: number
}

// ─── Descuentos ───────────────────────────────────────────────────────────────
export interface DescuentoView {
  id: number
  nombre: string
  tipo: 'PORCENTAJE' | 'FIJO'
  valor: number
  aplicaEn: 'ITEM' | 'TICKET'
  activo: boolean
  fechaFin: string | null
  creadoEn: string
  categorias: { id: number; nombre: string }[]
  productos: { id: number; nombre: string }[]
}
export interface DescuentoRequest {
  nombre: string
  tipo: 'PORCENTAJE' | 'FIJO'
  valor: number
  aplicaEn: 'ITEM' | 'TICKET'
  activo: boolean
  fechaFin?: string | null
}

// ─── Turnos ───────────────────────────────────────────────────────────────────
export interface MovimientoCajaDTO {
  id: number
  tipo: 'ENTRADA' | 'SALIDA'
  monto: number
  motivo: string
  creadoEn: string
}

export interface TurnoDTO {
  id: number
  usuarioNombre: string
  fondoInicial: number
  abiertoEn: string
  cerradoEn: string | null
  conteoEfectivo: number | null
  ventasEfectivo: number | null
  ventasTarjeta: number | null
  propinaEfectivo: number | null
  propinaTarjeta: number | null
  movimientosNeto: number | null
  efectivoEsperado: number | null
  diferencia: number | null
  estado: string
  notas: string | null
  ventasTotalActual: number | null
  ventasCountActual: number | null
  movimientos: MovimientoCajaDTO[]
}

// ─── Cierre mensual ─────────────────────────────────────────────────────────
export interface CierreMensualDTO {
  id: number | null
  anio: number
  mes: number
  usuarioNombre: string | null
  cerradoEn: string | null
  ventasEfectivo: number
  ventasTarjeta: number
  propinaEfectivo: number
  propinaTarjeta: number
  costoTotal: number
  gastosFijos: number
  utilidadNeta: number
  ventasCount: number
  notas: string | null
}

// ─── Configuración ────────────────────────────────────────────────────────────
export interface ConfiguracionDTO {
  ivaPorcentaje: number
  comisionTarjeta: number
  diasRevisionReceta: number
}

// ─── Ventas ───────────────────────────────────────────────────────────────────
export interface ItemRequest {
  productoId: number
  cantidad: number
  notas?: string
  modificadorOpcionIds?: number[]
  descuentoId?: number | null
}
export interface ItemResponse {
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  costoUnitario: number
  notas: string | null
  modificadores: ModificadorResponse[]
  descuentoNombre?: string | null
  descuentoMonto?: number | null
}
export interface VentaResponse {
  id: number
  total: number
  costoTotal: number
  propina: number
  ivaMonto: number
  comisionMonto: number
  estado: string
  metodoPago: string
  creadaEn: string
  items: ItemResponse[]
  descuentoTicketNombre?: string | null
  descuentoTicketMonto?: number | null
  splitGrupo?: string | null
  usuarioId?: number | null
  usuarioNombre?: string | null
  clientId?: string | null
}
export interface ResumenDia {
  fecha: string
  totalVentas: number
  ingresos: number
  costos: number
  totalIva: number
  totalComisiones: number
  utilidad: number
  ventasPorMetodoPago: Record<string, number>
}

export interface TopProducto {
  nombre: string
  cantidad: number
  ingresos: number
}

export interface ResumenPeriodo {
  desde: string
  hasta: string
  totalVentas: number
  ingresos: number
  costos: number
  totalIva: number
  totalComisiones: number
  utilidad: number
  ventasPorMetodoPago: Record<string, number>
  porDia: ResumenDia[]
  topProductos: TopProducto[]
}

// ─── Plantillas de receta ─────────────────────────────────────────────────────
export interface IngredienteLineaPlantillaDTO {
  id: number
  ingredienteId: number
  ingredienteNombre: string
  unidad: string
  cantidad: number
  mermaPorcentaje: number
}
export interface PlantillaDTO {
  id: number
  nombre: string
  activo: boolean
  ingredientes: IngredienteLineaPlantillaDTO[]
}

// ─── Punto de equilibrio ─────────────────────────────────────────────────────
export interface GastoFijoDTO {
  id: number
  nombre: string
  monto: number
  activo: boolean
}
export interface EquilibrioDTO {
  totalGastosFijos: number
  ingresosDelMes: number
  costoDelMes: number
  margenBruto: number       // 0-100
  metaVentas: number        // ventas necesarias para cubrir gastos fijos
  faltante: number
  porcentaje: number
}

// ─── Tickets abiertos (comandas) ──────────────────────────────────────────────
export interface TicketModificadorRequest {
  opcionId: number
  nombre: string
  precioExtra: number
}
export interface TicketItemRequest {
  productoId: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  notas?: string | null
  modificadores?: TicketModificadorRequest[]
  descuentoId?: number | null
}
export interface CrearTicketRequest {
  nombre?: string | null
  /** Generado por el dispositivo; permite reenviar sin duplicar. */
  clientId?: string
  items: TicketItemRequest[]
}
/** Estado completo de una comanda editada sin conexión. */
export interface SincronizarTicketRequest {
  clientId: string
  nombre: string | null
  estado: 'ABIERTO' | 'COBRADO' | 'CANCELADO'
  actualizadoEn: string
  ventaClientId?: string
  items: TicketItemRequest[]
}
export interface TicketModificadorResponse {
  opcionId: number
  nombre: string
  precioExtra: number
}
export interface TicketItemResponse {
  id: number
  productoId: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  notas: string | null
  descuentoId: number | null
  modificadores: TicketModificadorResponse[]
}
export interface TicketResponse {
  id: number
  /** Identificador del dispositivo; casa con la copia local. */
  clientId: string | null
  nombre: string | null
  estado: 'ABIERTO' | 'COBRADO' | 'CANCELADO'
  ventaId: number | null
  creadoEn: string
  actualizadoEn: string
  cerradoEn: string | null
  items: TicketItemResponse[]
  totalEstimado: number
}
export interface CobrarTicketRequest {
  metodoPago: string
  descuentoTicketId?: number | null
  propina?: number
}

// ── Pantalla de cocina ───────────────────────────────────────────────────────
// Estas formas NO llevan importes. El endpoint que las sirve es público (la
// tablet de cocina no inicia sesión), así que el backend omite precios y
// totales a propósito: lo que puede filtrarse es qué se está preparando, nunca
// cuánto factura el negocio. Por eso no se reutiliza TicketResponse.

export type EstadoPreparacion = 'PENDIENTE' | 'EN_PROCESO' | 'LISTO'

export interface ItemCocina {
  id: number
  nombreProducto: string
  cantidad: number
  notas: string | null
  modificadores: string[]
}

export interface ComandaCocina {
  id: number
  nombre: string | null
  estadoPreparacion: EstadoPreparacion
  /** Ya se cobró: el cliente está esperando su pedido. */
  cobrada: boolean
  creadoEn: string
  preparacionIniciadaEn: string | null
  listoEn: string | null
  items: ItemCocina[]
}

export interface EstadoCocina {
  turnoAbierto: boolean
  pendientes: ComandaCocina[]
  entregadas: ComandaCocina[]
}
