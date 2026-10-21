import { esErrorDeRed } from '../api/client'
import { listarProductosOffline, listarModificadoresProductoOffline } from '../api/productos'
import { listarCategoriasOffline } from '../api/categorias'
import {
  getDescuentoAplicableOffline, listarDescuentosAplicables, listarDescuentosOffline, listarDescuentosTicketOffline,
} from '../api/descuentos'
import { offlineDb } from './offlineDb'
import type { DescuentoView, ProductoDTO } from '../types/api'

/** Cuántas peticiones por producto se lanzan en paralelo al precargar. */
const CONCURRENCIA = 6

const CLAVE_PRECARGA = 'catalogo:precargadoEn'

/** Recorre la lista en lotes para no abrir cientos de conexiones a la vez. */
async function enLotes<T>(items: T[], fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += CONCURRENCIA) {
    await Promise.all(items.slice(i, i + CONCURRENCIA).map((it) => fn(it).catch(() => {})))
  }
}

let enCurso: Promise<boolean> | null = null

/**
 * Baja todo el catálogo a IndexedDB para que la caja funcione sin conexión
 * incluso la primera vez que se abre offline: productos, categorías,
 * descuentos de ticket y —producto por producto— sus modificadores y su
 * descuento aplicable, que antes solo se cacheaban al tocar el producto.
 *
 * Es idempotente y silenciosa: si no hay red simplemente devuelve false.
 */
export function precargarCatalogo(): Promise<boolean> {
  if (enCurso) return enCurso
  enCurso = ejecutarPrecarga().finally(() => { enCurso = null })
  return enCurso
}

async function ejecutarPrecarga(): Promise<boolean> {
  if (navigator.onLine === false) return false
  try {
    const [productos] = await Promise.all([
      listarProductosOffline(),
      listarCategoriasOffline(),
      listarDescuentosTicketOffline().catch(() => [] as DescuentoView[]),
      // Hacen falta al abrir una comanda guardada estando sin conexión.
      listarDescuentosOffline().catch(() => [] as DescuentoView[]),
    ])

    await enLotes(productos, (p: ProductoDTO) => listarModificadoresProductoOffline(p.id))
    await refrescarDescuentosAplicables(productos)

    await offlineDb.cache.put({
      key: CLAVE_PRECARGA,
      data: productos.length,
      actualizadoEn: new Date().toISOString(),
    })
    return true
  } catch (e) {
    if (esErrorDeRed(e)) return false
    return false
  }
}

/**
 * Reescribe la copia local del descuento de cada producto. Tiene que ir a la
 * red: la caja lee esa copia sin preguntar (getCacheado), así que si la
 * precarga también la reutilizaba, un descuento recién creado no aparecía
 * hasta el siguiente turno.
 */
export async function refrescarDescuentosAplicables(productos?: ProductoDTO[]): Promise<void> {
  try {
    const aplicables = await listarDescuentosAplicables()
    const ahora = new Date().toISOString()
    await offlineDb.cache.bulkPut(aplicables.map((a) => ({
      key: `descuentoAplicable:${a.productoId}`,
      data: a.descuento,
      actualizadoEn: ahora,
    })))
  } catch (e) {
    if (esErrorDeRed(e) || !productos) return
    // Un backend sin el endpoint todavía: producto por producto, como antes.
    await enLotes(productos, (p: ProductoDTO) => getDescuentoAplicableOffline(p.id))
  }
}

/** Fecha ISO de la última precarga completa, o null si nunca se hizo. */
export async function ultimaPrecarga(): Promise<string | null> {
  const entry = await offlineDb.cache.get(CLAVE_PRECARGA)
  return entry?.actualizadoEn ?? null
}

/** ¿Hay al menos un catálogo utilizable guardado en este dispositivo? */
export async function hayCatalogoEnCache(): Promise<boolean> {
  return (await offlineDb.cache.get('productos')) !== undefined
}

let precargaIniciada = false

/**
 * Arranca la precarga al abrir la app y la repite cada vez que vuelve
 * la conexión, para que la caché nunca dependa de que el usuario haya
 * entrado a Caja con internet.
 */
export function iniciarPrecarga(): void {
  if (precargaIniciada) return
  precargaIniciada = true
  window.addEventListener('online', () => { precargarCatalogo().catch(() => {}) })
  precargarCatalogo().catch(() => {})
}
