/**
 * Fechas en la zona del negocio.
 *
 * `new Date().toISOString()` devuelve la fecha en UTC, y las 18:00 de Mérida
 * son las 00:00 UTC. Como la cafetería abre por la tarde, durante casi todo el
 * servicio ese cálculo devolvía **el día siguiente**: las ventas del día salían
 * fechadas mañana, y una compra capturada de noche se guardaba con la fecha
 * equivocada.
 *
 * Estaba copiado en cinco pantallas, cada una con su propia versión del mismo
 * error. Vive aquí para que corregirlo sea un solo sitio, y para que la próxima
 * pantalla no vuelva a escribirlo mal.
 *
 * El servidor cuenta los días con este mismo criterio.
 */

const ZONA_NEGOCIO = 'America/Merida'

/** Una fecha cualquiera, en formato AAAA-MM-DD según el calendario de Mérida. */
export const enZonaNegocio = (d: Date): string =>
  // 'en-CA' da exactamente AAAA-MM-DD, que es lo que esperan los <input type="date">.
  new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)

/** Hoy, en Mérida. */
export const hoy = (): string => enZonaNegocio(new Date())

/**
 * N días antes de hoy.
 *
 * La resta se hace sobre la fecha ya resuelta en Mérida y en UTC puro, para que
 * el propio cálculo no vuelva a cruzar husos por el camino.
 */
export const diasAtras = (n: number): string => {
  const [a, m, d] = hoy().split('-').map(Number)
  const base = new Date(Date.UTC(a, m - 1, d))
  base.setUTCDate(base.getUTCDate() - n)
  return base.toISOString().slice(0, 10)
}

/** El día 1 del mes en curso. */
export const primerDiaDelMes = (): string => hoy().slice(0, 8) + '01'
