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
/**
 * Fila de la tabla de costeo. Sin líneas de ingredientes ni historial: eso se
 * pide con detalleCosteo al expandir un producto. Bajarlo para todo el catálogo
 * costaba del orden de mil consultas contra la base remota.
 */
export interface CosteoResumenDTO {
  productoId: number
  nombre: string
  categoria: string | null
  precioVenta: number
  costoTotal: number
  margen: number
  margenPorcentaje: number
  margenSeguridad: number | null
  costoConMargen: number | null
  /** Ni receta ni plantillas. Lo calcula el backend porque aquí ya no llegan. */
  sinReceta: boolean
}

/** Costeo completo de un producto, con el desglose que muestra la fila expandida. */
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

// ── Compras (control de gasto) ───────────────────────────────────────────────
// Las líneas describen lo que decía el ticket y NO apuntan a ingredientes:
// emparejar la descripción del proveedor con el catálogo propio es otro
// problema, mucho más caro, y no hace falta para saber cuánto se gasta y en qué.

export type CategoriaCompra = 'INSUMOS' | 'LIMPIEZA' | 'EMPAQUE' | 'MANTENIMIENTO' | 'OTROS'

export const CATEGORIAS_COMPRA: CategoriaCompra[] =
  ['INSUMOS', 'LIMPIEZA', 'EMPAQUE', 'MANTENIMIENTO', 'OTROS']

export interface CompraLineaDTO {
  id: number
  descripcion: string
  cantidad: number | null
  precioUnitario: number | null
  importe: number
}

export interface CompraDTO {
  id: number
  proveedor: string | null
  fecha: string
  total: number
  categoria: CategoriaCompra
  metodoPago: string | null
  notas: string | null
  fotoUrl: string | null
  clientId: string | null
  creadoEn: string
  lineas: CompraLineaDTO[]
  /** Si las líneas suman el total. Falso = la captura necesita revisión. */
  cuadra: boolean
}

export interface CompraLineaRequest {
  descripcion: string
  cantidad?: number | null
  precioUnitario?: number | null
  importe: number
}

export interface CompraRequest {
  proveedor?: string | null
  fecha: string
  total: number
  categoria: CategoriaCompra
  metodoPago?: string | null
  notas?: string | null
  clientId?: string
  lineas: CompraLineaRequest[]
}

/** Lo que devuelve la lectura del ticket: una propuesta, no un registro. */
export interface ExtraccionTicket {
  proveedor: string | null
  fecha: string | null
  total: number | null
  categoria: CategoriaCompra
  lineas: {
    descripcion: string
    cantidad: number | null
    precioUnitario: number | null
    importe: number | null
  }[]
}

export interface ResumenCompras {
  desde: string
  hasta: string
  total: number
  compras: number
  porCategoria: Record<string, number>
}

// ── Bitácora de anulaciones ──────────────────────────────────────────────────
// Anular una venta mueve dinero. El motivo es obligatorio y sale de una lista
// cerrada: la categoría es lo que deja ver patrones, porque el texto libre
// solo no se puede agrupar.

export type MotivoAnulacion =
  | 'ERROR_COBRO'
  | 'CLIENTE_CANCELO'
  | 'PRODUCTO_MAL'
  | 'PRUEBA'
  | 'CORRECCION_SPLIT'
  | 'OTRO'

/**
 * Los que se ofrecen al anular a mano. CORRECCION_SPLIT queda fuera a
 * propósito: lo pone el POS solo al deshacer un cobro de una cuenta dividida.
 */
export const MOTIVOS_ANULACION: { valor: MotivoAnulacion; etiqueta: string }[] = [
  { valor: 'ERROR_COBRO', etiqueta: 'Error al cobrar' },
  { valor: 'CLIENTE_CANCELO', etiqueta: 'El cliente canceló' },
  { valor: 'PRODUCTO_MAL', etiqueta: 'Producto mal o devuelto' },
  { valor: 'PRUEBA', etiqueta: 'Prueba o capacitación' },
  { valor: 'OTRO', etiqueta: 'Otro' },
]

export const ETIQUETA_MOTIVO: Record<MotivoAnulacion, string> = {
  ERROR_COBRO: 'Error al cobrar',
  CLIENTE_CANCELO: 'El cliente canceló',
  PRODUCTO_MAL: 'Producto mal o devuelto',
  PRUEBA: 'Prueba o capacitación',
  CORRECCION_SPLIT: 'Corrección al dividir cuenta',
  OTRO: 'Otro',
}

export interface AnulacionDTO {
  id: number
  ventaId: number
  /** Quien anuló. */
  anuladaPor: string | null
  /** Quien había hecho la venta. */
  vendedor: string | null
  motivo: MotivoAnulacion
  nota: string | null
  totalAnulado: number
  metodoPago: string | null
  ocurridoEn: string
}
