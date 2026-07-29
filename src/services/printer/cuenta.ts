import { ReceiptBuilder } from './escpos'
import { printBytes } from './connection'
import { imprimirEncabezado } from './encabezado'
import type { TicketResponse } from '../../types/api'

const fmt = (n: number) => `$${n.toFixed(2)}`

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

export async function construirCuenta(ticket: TicketResponse): Promise<Uint8Array> {
  const b = new ReceiptBuilder().init()
  await imprimirEncabezado(b)

  b.divider()
  b.line(`Ticket #${ticket.id}${ticket.nombre ? ` · ${ticket.nombre}` : ''}`)
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

export async function imprimirCuenta(ticket: TicketResponse): Promise<void> {
  await printBytes(await construirCuenta(ticket))
}
