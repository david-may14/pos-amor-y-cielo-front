import { ReceiptBuilder } from './escpos'
import { getLogoRaster } from './logo'

export async function imprimirEncabezado(b: ReceiptBuilder): Promise<void> {
  b.align('center')
  const logo = await getLogoRaster()
  if (logo) {
    b.image(logo.widthBytes, logo.heightDots, logo.data)
    b.feed(1)
  } else {
    b.bold(true).line('AMOR & CIELO').bold(false)
  }
  b.line('Cafetería')
  b.line('Mérida, Yucatán')
  b.align('left')
}
