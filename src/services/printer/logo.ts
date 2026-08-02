export interface LogoRaster {
  widthBytes: number
  heightDots: number
  data: Uint8Array
}

const LOGO_SRC = '/logo-dark.svg' // wordmark en verde forest — se ve bien sobre papel térmico blanco
const UMBRAL_NEGRO = 160 // luminancia (0-255) por debajo de la cual un pixel se imprime

let cached: Promise<LogoRaster | null> | null = null

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`No se pudo cargar ${src}`))
    img.src = src
  })
}

async function buildRaster(targetWidthDots: number): Promise<LogoRaster> {
  const img = await loadImage(LOGO_SRC)
  const widthBytes = Math.ceil(targetWidthDots / 8)
  const canvasWidth = widthBytes * 8 // alinear a múltiplo de 8 para el empaquetado en bits
  const canvasHeight = Math.round(img.height * (targetWidthDots / img.width))

  const canvas = document.createElement('canvas')
  canvas.width = canvasWidth
  canvas.height = canvasHeight
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)
  ctx.drawImage(img, 0, 0, targetWidthDots, canvasHeight)

  const { data } = ctx.getImageData(0, 0, canvasWidth, canvasHeight)
  const bytes = new Uint8Array(widthBytes * canvasHeight)
  for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
      const i = (y * canvasWidth + x) * 4
      const alpha = data[i + 3]
      const luminancia = alpha === 0 ? 255 : 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      if (luminancia < UMBRAL_NEGRO) {
        bytes[y * widthBytes + (x >> 3)] |= 0x80 >> (x % 8)
      }
    }
  }
  return { widthBytes, heightDots: canvasHeight, data: bytes }
}

/** Convierte el logo a bitmap una sola vez por sesión; null si falla (ej. sin conexión al recargar). */
export function getLogoRaster(targetWidthDots = 200): Promise<LogoRaster | null> {
  if (!cached) {
    cached = buildRaster(targetWidthDots).catch(() => null)
  }
  return cached
}
