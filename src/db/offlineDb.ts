import Dexie, { type Table } from 'dexie'
import type { ItemRequest, MetodoPago, Rol } from '../types/api'

export interface VentaPendiente {
  clientId: string
  items: ItemRequest[]
  metodoPago: MetodoPago
  descuentoTicketId: number | null
  propina: number
  ocurrioEn: string
  creadoEn: string
  intentos: number
  ultimoError?: string
}

export interface CacheEntry {
  key: string
  data: unknown
  actualizadoEn: string
}

/**
 * Sesión guardada bajo PIN: el refresh token viaja cifrado con AES-GCM usando
 * una clave derivada del PIN, así que el blob por sí solo no sirve de nada.
 */
export interface SesionPin {
  id: 'actual'
  salt: Uint8Array
  iv: Uint8Array
  cifrado: ArrayBuffer
  nombre: string
  rol: Rol
  intentosFallidos: number
  creadoEn: string
}

/** Item de una comanda tal y como se guarda en el dispositivo. */
export interface TicketItemLocal {
  productoId: number
  nombreProducto: string
  cantidad: number
  precioUnitario: number
  notas?: string | null
  descuentoId?: number | null
  modificadores?: { opcionId: number; nombre: string; precioExtra: number }[]
}

/**
 * Comanda guardada en el dispositivo. Es la copia con la que trabaja la caja:
 * se puede crear y editar sin conexión, y el servidor se entera después.
 */
export interface TicketLocal {
  clientId: string
  /** id del servidor una vez sincronizada; null mientras solo existe aquí. */
  servidorId: number | null
  nombre: string | null
  estado: 'ABIERTO' | 'COBRADO' | 'CANCELADO'
  items: TicketItemLocal[]
  totalEstimado: number
  creadoEn: string
  actualizadoEn: string
  /** Si se cobró sin conexión, la venta encolada a la que corresponde. */
  ventaClientId?: string
  /** true mientras el servidor no tenga esta versión. */
  pendiente: boolean
  ultimoError?: string
}

class OfflineDb extends Dexie {
  ventasPendientes!: Table<VentaPendiente, string>
  cache!: Table<CacheEntry, string>
  sesionPin!: Table<SesionPin, string>
  tickets!: Table<TicketLocal, string>

  constructor() {
    super('pos_amor_y_cielo_offline')
    this.version(1).stores({
      ventasPendientes: 'clientId, creadoEn',
      cache: 'key',
    })
    this.version(2).stores({
      ventasPendientes: 'clientId, creadoEn',
      cache: 'key',
      sesionPin: 'id',
    })
    this.version(3).stores({
      ventasPendientes: 'clientId, creadoEn',
      cache: 'key',
      sesionPin: 'id',
      // pendiente no se indexa: IndexedDB no admite booleanos como clave.
      tickets: 'clientId, estado, actualizadoEn',
    })
  }
}

export const offlineDb = new OfflineDb()
