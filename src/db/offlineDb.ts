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

class OfflineDb extends Dexie {
  ventasPendientes!: Table<VentaPendiente, string>
  cache!: Table<CacheEntry, string>
  sesionPin!: Table<SesionPin, string>

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
  }
}

export const offlineDb = new OfflineDb()
