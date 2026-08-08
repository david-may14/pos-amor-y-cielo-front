/**
 * Reduce una foto antes de mandarla a leer.
 *
 * No es cosmético: una foto de celular sin tocar pesa entre 3 y 8 MB, y en
 * base64 crece un tercio más. Eso sería lento de subir con los datos de la
 * tablet y un pico de memoria feo del lado del servidor. Reducida a 2000 px
 * queda en unos cientos de kilobytes.
 *
 * El límite es 2000 px y no menos porque la resolución ES la precisión con un
 * ticket térmico despintado: por debajo de eso se pierde la letra chica, que es
 * justo lo que hay que leer.
 */

const LADO_MAXIMO = 2000
const CALIDAD = 0.75

export interface FotoComprimida {
  /** base64 sin el prefijo `data:...;base64,` — es lo que espera la API. */
  base64: string
  tipoMime: string
  /** Para poder enseñar la foto en la pantalla de revisión sin volver a leerla. */
  dataUrl: string
}

export async function comprimirImagen(file: File): Promise<FotoComprimida> {
  const bitmap = await cargarBitmap(file)

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
  const ancho = Math.round(bitmap.width * escala)
  const alto = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen en este dispositivo')
  ctx.drawImage(bitmap, 0, 0, ancho, alto)

  // JPEG y no PNG: un ticket es una foto, y en PNG pesaría varias veces más
  // sin ganar nada legible.
  const dataUrl = canvas.toDataURL('image/jpeg', CALIDAD)
  const base64 = dataUrl.split(',')[1] ?? ''

  return { base64, tipoMime: 'image/jpeg', dataUrl }
}

/**
 * createImageBitmap no está en todos los WebView antiguos de Android, así que
 * se cae a un <img> con object URL, que sí está en todos.
 */
async function cargarBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // sigue por el camino del <img>
    }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('No se pudo leer la imagen'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
