import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDb, type VentaPendiente } from './offlineDb'
import { crearVenta } from '../api/ventas'
import { esErrorDeRed } from '../api/client'
import type { ItemRequest, MetodoPago } from '../types/api'

export interface NuevaVentaPendiente {
  items: ItemRequest[]
  metodoPago: MetodoPago
  descuentoTicketId: number | null
  propina: number
}

/** Guarda una venta que no se pudo mandar al servidor por falta de conexión. */
export async function encolarVenta(payload: NuevaVentaPendiente): Promise<VentaPendiente> {
  const ahora = new Date().toISOString()
  const venta: VentaPendiente = {
    clientId: crypto.randomUUID(),
    ...payload,
    ocurrioEn: ahora,
    creadoEn: ahora,
    intentos: 0,
  }
  await offlineDb.ventasPendientes.add(venta)
  return venta
}

/** Cuenta en vivo de ventas encoladas — para mostrar el aviso en la UI. */
export function usePendientesCount(): number {
  return useLiveQuery(() => offlineDb.ventasPendientes.count(), [], 0) ?? 0
}

/**
 * Intenta mandar al backend cada venta pendiente, en orden de creación.
 * clientId hace que reintentar una que ya se sincronizó no la duplique.
 * Si el fallo es de red, se detiene (no tiene caso seguir intentando las demás ahora).
 */
export async function sincronizarPendientes(): Promise<{ sincronizadas: number; conError: number }> {
  const pendientes = await offlineDb.ventasPendientes.orderBy('creadoEn').toArray()
  let sincronizadas = 0
  let conError = 0

  for (const p of pendientes) {
    try {
      await crearVenta(p.items, p.metodoPago, p.descuentoTicketId, p.propina, null, p.clientId, p.ocurrioEn)
      await offlineDb.ventasPendientes.delete(p.clientId)
      sincronizadas++
    } catch (e) {
      if (esErrorDeRed(e)) break
      conError++
      await offlineDb.ventasPendientes.update(p.clientId, {
        intentos: p.intentos + 1,
        ultimoError: e instanceof Error ? e.message : 'Error desconocido',
      })
    }
  }

  return { sincronizadas, conError }
}

let autoSyncIniciado = false

/** Reintenta la cola al reconectar y cada minuto mientras la app esté abierta. */
export function iniciarAutoSync(): void {
  if (autoSyncIniciado) return
  autoSyncIniciado = true
  window.addEventListener('online', () => { sincronizarPendientes().catch(() => {}) })
  setInterval(() => { sincronizarPendientes().catch(() => {}) }, 60_000)
  sincronizarPendientes().catch(() => {})
}
