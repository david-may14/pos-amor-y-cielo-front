const ESC = 0x1b
const GS = 0x1d

// Caracteres por línea para papel de 58mm con fuente A (12x24pt) — estándar en
// impresoras térmicas de este ancho.
export const LINE_WIDTH = 32

// Posición de WPC1252 en la tabla de code pages ESC/POS (Epson). La impresora
// declara soporte para WPC1252, que cubre los acentos y la Ñ del español.
const CODEPAGE_WPC1252 = 16

// TextEncoder del navegador solo produce UTF-8; para code page 1252 mapeamos
// a mano los caracteres no-ASCII que realmente aparecen en un recibo en español.
const WIN1252_MAP: Record<string, number> = {
  á: 0xe1, é: 0xe9, í: 0xed, ó: 0xf3, ú: 0xfa,
  Á: 0xc1, É: 0xc9, Í: 0xcd, Ó: 0xd3, Ú: 0xda,
  ñ: 0xf1, Ñ: 0xd1, ü: 0xfc, Ü: 0xdc,
  '¿': 0xbf, '¡': 0xa1,
}

function encodeWin1252(str: string): number[] {
  const out: number[] = []
  for (const ch of str) {
    const code = ch.codePointAt(0)!
    out.push(code < 0x80 ? code : (WIN1252_MAP[ch] ?? 0x3f))
  }
  return out
}

export class ReceiptBuilder {
  private bytes: number[] = []

  private push(...values: number[]): this {
    this.bytes.push(...values)
    return this
  }

  init(): this {
    this.push(ESC, 0x40) // ESC @ — reset impresora
    return this.push(ESC, 0x74, CODEPAGE_WPC1252) // ESC t n — selecciona code page
  }

  align(pos: 'left' | 'center' | 'right'): this {
    const n = pos === 'left' ? 0 : pos === 'center' ? 1 : 2
    return this.push(ESC, 0x61, n) // ESC a n
  }

  bold(on: boolean): this {
    return this.push(ESC, 0x45, on ? 1 : 0) // ESC E n
  }

  /**
   * Multiplica el tamaño del carácter (1–8 en cada eje). Lo usa la comanda de
   * cocina: ese papel se lee de reojo desde la barra, no en la mano como un
   * recibo. Ojo, a doble ancho caben la mitad de caracteres por línea.
   */
  size(ancho: number, alto: number): this {
    const n = ((Math.min(8, Math.max(1, ancho)) - 1) << 4) | (Math.min(8, Math.max(1, alto)) - 1)
    return this.push(GS, 0x21, n) // GS ! n
  }

  text(str: string): this {
    this.bytes.push(...encodeWin1252(str))
    return this
  }

  line(str = ''): this {
    return this.text(str).text('\n')
  }

  /** Línea con dos columnas: texto a la izquierda, valor alineado a la derecha. */
  row(left: string, right: string): this {
    const space = Math.max(1, LINE_WIDTH - left.length - right.length)
    return this.line(left + ' '.repeat(space) + right)
  }

  divider(char = '-'): this {
    return this.line(char.repeat(LINE_WIDTH))
  }

  feed(n = 1): this {
    return this.push(ESC, 0x64, n) // ESC d n — avanza n líneas
  }

  /** Imprime un bitmap monocromo (GS v 0). widthBytes = ancho en bytes (ancho en dots / 8). */
  image(widthBytes: number, heightDots: number, data: Uint8Array): this {
    this.push(
      GS, 0x76, 0x30, 0x00,
      widthBytes & 0xff, (widthBytes >> 8) & 0xff,
      heightDots & 0xff, (heightDots >> 8) & 0xff,
    )
    this.bytes.push(...data)
    return this
  }

  /** Corte de papel. Solo enviar si la impresora tiene cortador automático. */
  cut(): this {
    return this.push(GS, 0x56, 0x01) // GS V 1 — corte parcial
  }

  /** Pulso al cajón de dinero conectado al puerto de la impresora (pin 0 = el más común). */
  openDrawer(pin: 0 | 1 = 0): this {
    return this.push(ESC, 0x70, pin, 25, 250) // ESC p m t1 t2
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes)
  }
}
