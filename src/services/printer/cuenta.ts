import { ReceiptBuilder } from './escpos'
import { printBytes } from './connection'
import { imprimirEncabezado } from './encabezado'
/**
 * Forma mínima que necesita una cuenta. Se define aquí en vez de usar
 * TicketResponse para poder imprimir también comandas que solo existen en el
 * dispositivo y todavía no tienen id del servidor.
 */
export interface CuentaImprimible {
  id?: number | null
  nombre: string | null
  creadoEn: string
  totalEstimado: number
  items: {
    cantidad: number
    nombreProducto: string
    precioUnitario: number
    notas?: string | null
    modificadores?: { nombre: string }[]
  }[]
}

const fmt = (n: number) => `$${n.toFixed(2)}`

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

export async function construirCuenta(ticket: CuentaImprimible): Promise<Uint8Array> {
  const b = new ReceiptBuilder().init()
  await imprimirEncabezado(b)

  b.divider()
  b.line(`${ticket.id ? `Ticket #${ticket.id}` : 'Comanda'}${ticket.nombre ? ` · ${ticket.nombre}` : ''}`)
  b.line(fmtFecha(ticket.creadoEn))
  b.divider()

  for (const item of ticket.items) {
    b.row(`${item.cantidad}x ${item.nombreProducto}`, fmt(item.precioUnitario * item.cantidad))
    for (const m of item.modificadores ?? []) {
      b.line(`   + ${m.nombre}`)
    }
    if (item.notas) b.line(`   * ${item.notas}`)
  }
  b.divider()

  b.bold(true).row('Total a pagar', fmt(ticket.totalEstimado)).bold(false)
  b.divider()

  b.align('center')
  b.line('¡Muchas gracias por su visita!')
  b.feed(4)

  return b.build()
}

export async function imprimirCuenta(ticket: CuentaImprimible): Promise<void> {
  await printBytes(await construirCuenta(ticket))
}
