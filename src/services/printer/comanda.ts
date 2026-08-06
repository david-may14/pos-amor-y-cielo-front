import { ReceiptBuilder } from './escpos'
import { printBytes } from './connection'

/**
 * Comanda de cocina en papel: el respaldo de la pantalla cuando no hay red.
 *
 * Sale de la impresora pareada a la tablet del POS, no de la de cocina, porque
 * el Bluetooth está emparejado con esa. Es un camino de ida — el papel no puede
 * marcarse como listo — y por eso solo se usa cuando la comanda no llegó al
 * servidor y la pantalla de cocina nunca la va a ver.
 *
 * No lleva precios: quien la lee está preparando, no cobrando. Y va a doble
 * altura porque se lee de reojo desde la barra.
 */
export interface ComandaImprimible {
  /** Puede no existir todavía: la comanda se creó sin conexión. */
  id?: number | null
  nombre: string | null
  creadoEn: string
  items: {
    cantidad: number
    nombreProducto: string
    notas?: string | null
    modificadores?: { nombre: string }[]
  }[]
}

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

export function construirComanda(c: ComandaImprimible): Uint8Array {
  const b = new ReceiptBuilder().init()

  // Sin logo ni encabezado de marca a propósito: esto no es un recibo para el
  // cliente, y cada línea de más es papel y segundos de impresión en hora pico.
  b.align('center').size(2, 2).bold(true)
  b.line('COCINA')
  b.size(1, 1).bold(false)

  b.align('left')
  b.divider()
  b.size(1, 2)
  b.line(c.nombre?.trim() || (c.id ? `Comanda #${c.id}` : 'Comanda'))
  b.size(1, 1)
  b.line(fmtHora(c.creadoEn))
  b.divider()

  for (const item of c.items) {
    b.size(1, 2).bold(true)
    b.line(`${item.cantidad}x ${item.nombreProducto}`)
    b.size(1, 1).bold(false)
    for (const m of item.modificadores ?? []) {
      b.line(`   + ${m.nombre}`)
    }
    // La nota es lo que más se pasa por alto; va en negrita aunque el resto no.
    if (item.notas) {
      b.bold(true).line(`   * ${item.notas}`).bold(false)
    }
  }

  b.divider()
  b.feed(4)

  return b.build()
}

export async function imprimirComanda(c: ComandaImprimible): Promise<void> {
  await printBytes(construirComanda(c))
}
