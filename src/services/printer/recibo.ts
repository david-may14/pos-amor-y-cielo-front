import { ReceiptBuilder } from './escpos'
import { printBytes } from './connection'
import { imprimirEncabezado } from './encabezado'
import type { VentaResponse } from '../../types/api'

const fmt = (n: number) => `$${n.toFixed(2)}`

const fmtFecha = (iso: string) =>
  new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })

const METODO_LABEL: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
}

export async function construirRecibo(venta: VentaResponse): Promise<Uint8Array> {
  const b = new ReceiptBuilder().init()
  await imprimirEncabezado(b)

  b.divider()
  b.line(`Venta #${venta.id}`)
  b.line(fmtFecha(venta.creadaEn))
  if (venta.usuarioNombre) b.line(`Atendió: ${venta.usuarioNombre}`)
  b.divider()

  for (const item of venta.items) {
    b.row(`${item.cantidad}x ${item.nombreProducto}`, fmt(item.precioUnitario * item.cantidad))
    for (const m of item.modificadores ?? []) {
      b.line(`   + ${m.nombre}`)
    }
    if (item.notas) b.line(`   * ${item.notas}`)
    if (item.descuentoNombre && item.descuentoMonto) {
      b.row(`   - ${item.descuentoNombre}`, `-${fmt(item.descuentoMonto)}`)
    }
  }
  b.divider()

  if (venta.descuentoTicketNombre && venta.descuentoTicketMonto) {
    b.row(venta.descuentoTicketNombre, `-${fmt(venta.descuentoTicketMonto)}`)
  }
  if (venta.propina > 0) {
    b.row('Propina', fmt(venta.propina))
  }
  b.bold(true)
  b.row('TOTAL', fmt(venta.total + (venta.propina ?? 0)))
  b.bold(false)
  b.line(`Pago: ${METODO_LABEL[venta.metodoPago] ?? venta.metodoPago}`)
  b.divider()

  b.align('center').line('¡Gracias por tu visita!')
  b.feed(4)

  return b.build()
}

export async function imprimirRecibo(venta: VentaResponse): Promise<void> {
  await printBytes(await construirRecibo(venta))
}
