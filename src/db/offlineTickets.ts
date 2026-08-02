import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDb, type TicketItemLocal, type TicketLocal } from './offlineDb'
import { esErrorDeRed } from '../api/errores'
import { listarTickets, sincronizarTicket } from '../api/tickets'
import type { TicketResponse } from '../types/api'

/**
 * Comandas locales.
 *
 * El dispositivo es la copia de trabajo: crear y editar una comanda nunca
 * necesita servidor. Cada una lleva un clientId propio, así que subirla varias
 * veces tras una reconexión deja siempre el mismo resultado.
 */

export function totalDeItems(items: TicketItemLocal[]): number {
  return items.reduce((sum, i) => {
    const extras = (i.modificadores ?? []).reduce((s, m) => s + m.precioExtra, 0)
    return sum + (i.precioUnitario + extras) * i.cantidad
  }, 0)
}

export async function crearTicketLocal(
  nombre: string | null,
  items: TicketItemLocal[],
): Promise<TicketLocal> {
  const ahora = new Date().toISOString()
  const ticket: TicketLocal = {
    clientId: crypto.randomUUID(),
    servidorId: null,
    nombre,
    estado: 'ABIERTO',
    items,
    totalEstimado: totalDeItems(items),
    creadoEn: ahora,
    actualizadoEn: ahora,
    pendiente: true,
  }
  await offlineDb.tickets.add(ticket)
  sincronizarTickets().catch(() => {})
  return ticket
}

export async function actualizarTicketLocal(
  clientId: string,
  nombre: string | null,
  items: TicketItemLocal[],
): Promise<void> {
  await offlineDb.tickets.update(clientId, {
    nombre,
    items,
    totalEstimado: totalDeItems(items),
    actualizadoEn: new Date().toISOString(),
    pendiente: true,
  })
  sincronizarTickets().catch(() => {})
}

export async function cancelarTicketLocal(clientId: string): Promise<void> {
  await offlineDb.tickets.update(clientId, {
    estado: 'CANCELADO',
    actualizadoEn: new Date().toISOString(),
    pendiente: true,
  })
  sincronizarTickets().catch(() => {})
}

/** Marca la comanda como cobrada y la enlaza con la venta (encolada o ya hecha). */
export async function marcarTicketCobrado(clientId: string, ventaClientId?: string): Promise<void> {
  await offlineDb.tickets.update(clientId, {
    estado: 'COBRADO',
    ventaClientId,
    actualizadoEn: new Date().toISOString(),
    pendiente: true,
  })
  sincronizarTickets().catch(() => {})
}

export async function obtenerTicketLocal(clientId: string): Promise<TicketLocal | undefined> {
  return offlineDb.tickets.get(clientId)
}

export async function listarTicketsAbiertos(): Promise<TicketLocal[]> {
  const abiertos = await offlineDb.tickets.where('estado').equals('ABIERTO').toArray()
  return abiertos.sort((a, b) => a.creadoEn.localeCompare(b.creadoEn))
}

/** Lista en vivo para la UI: se refresca sola al sincronizar. */
export function useTicketsAbiertos(): TicketLocal[] {
  return useLiveQuery(async () => listarTicketsAbiertos(), [], []) ?? []
}

/** Cuántas comandas están esperando subir al servidor. */
export function useTicketsPendientesCount(): number {
  return useLiveQuery(
    async () => (await offlineDb.tickets.toArray()).filter((t) => t.pendiente).length,
    [],
    0,
  ) ?? 0
}

/** Convierte una comanda del servidor a la forma local. */
function desdeServidor(t: TicketResponse): TicketLocal | null {
  if (!t.clientId) return null // tickets antiguos sin identificador; se ignoran
  return {
    clientId: t.clientId,
    servidorId: t.id,
    nombre: t.nombre ?? null,
    estado: t.estado as TicketLocal['estado'],
    items: t.items.map((i) => ({
      productoId: i.productoId,
      nombreProducto: i.nombreProducto,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      notas: i.notas ?? undefined,
      descuentoId: i.descuentoId ?? null,
      modificadores: (i.modificadores ?? []).map((m) => ({
        opcionId: m.opcionId, nombre: m.nombre, precioExtra: m.precioExtra,
      })),
    })),
    totalEstimado: t.totalEstimado,
    creadoEn: t.creadoEn,
    actualizadoEn: t.actualizadoEn,
    pendiente: false,
  }
}

/**
 * Sube las comandas pendientes y luego baja las del servidor.
 *
 * El orden importa: si bajáramos primero, una comanda creada en este
 * dispositivo y aún no subida no aparecería en la lista del servidor y
 * podríamos borrarla por error.
 */
export async function sincronizarTickets(): Promise<{ subidas: number; bajadas: number }> {
  let subidas = 0
  let bajadas = 0

  const pendientes = (await offlineDb.tickets.toArray()).filter((t) => t.pendiente)

  for (const t of pendientes) {
    if (t.items.length === 0) {
      // El servidor exige al menos un item; una comanda vacía solo vive aquí.
      continue
    }
    try {
      const remoto = await sincronizarTicket({
        clientId: t.clientId,
        nombre: t.nombre,
        estado: t.estado,
        actualizadoEn: t.actualizadoEn,
        ventaClientId: t.ventaClientId,
        items: t.items,
      })
      await offlineDb.tickets.update(t.clientId, {
        servidorId: remoto.id,
        estado: remoto.estado as TicketLocal['estado'],
        pendiente: false,
        ultimoError: undefined,
      })
      subidas++
    } catch (e) {
      if (esErrorDeRed(e)) return { subidas, bajadas } // sin red, se reintenta luego
      await offlineDb.tickets.update(t.clientId, {
        ultimoError: e instanceof Error ? e.message : 'Error desconocido',
      })
    }
  }

  // Bajar lo que haya en el servidor (comandas abiertas en otros dispositivos).
  try {
    const remotos = await listarTickets('ABIERTO')
    const locales = await offlineDb.tickets.toArray()
    const pendientesPorClientId = new Set(locales.filter((t) => t.pendiente).map((t) => t.clientId))

    for (const r of remotos) {
      const local = desdeServidor(r)
      if (!local) continue
      // Nunca pisar una edición local que aún no ha subido.
      if (pendientesPorClientId.has(local.clientId)) continue
      await offlineDb.tickets.put(local)
      bajadas++
    }

    // Las que el servidor ya no tiene abiertas (cobradas o canceladas en otro
    // equipo) dejan de estar abiertas aquí también.
    const abiertosRemotos = new Set(remotos.map((r) => r.clientId).filter(Boolean))
    for (const l of locales) {
      if (l.estado === 'ABIERTO' && !l.pendiente && l.servidorId !== null
          && !abiertosRemotos.has(l.clientId)) {
        await offlineDb.tickets.delete(l.clientId)
      }
    }
  } catch (e) {
    if (!esErrorDeRed(e)) throw e
  }

  return { subidas, bajadas }
}

let autoSyncTicketsIniciado = false

/** Reintenta al recuperar la conexión y cada minuto mientras la app esté abierta. */
export function iniciarAutoSyncTickets(): void {
  if (autoSyncTicketsIniciado) return
  autoSyncTicketsIniciado = true
  window.addEventListener('online', () => { sincronizarTickets().catch(() => {}) })
  setInterval(() => { sincronizarTickets().catch(() => {}) }, 60_000)
  sincronizarTickets().catch(() => {})
}
