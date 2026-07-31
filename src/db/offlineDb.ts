import Dexie, { type Table } from 'dexie'
import type { ItemRequest, MetodoPago } from '../types/api'

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

class OfflineDb extends Dexie {
  ventasPendientes!: Table<VentaPendiente, string>
  cache!: Table<CacheEntry, string>

  constructor() {
    super('pos_amor_y_cielo_offline')
    this.version(1).stores({
      ventasPendientes: 'clientId, creadoEn',
      cache: 'key',
    })
  }
}

export const offlineDb = new OfflineDb()
