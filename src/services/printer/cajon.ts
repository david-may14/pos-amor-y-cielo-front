import { ReceiptBuilder } from './escpos'
import { printBytes } from './connection'

/** Abre el cajón de dinero conectado al puerto de la impresora. */
export async function abrirCajon(): Promise<void> {
  await printBytes(new ReceiptBuilder().openDrawer().build())
}
