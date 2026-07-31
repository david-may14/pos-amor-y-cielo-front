/** Se lanza cuando el fetch falla por falta de conexión (no por un error del servidor). */
export class NetworkError extends Error {
  constructor(message = 'Sin conexión') {
    super(message)
    this.name = 'NetworkError'
  }
}

/**
 * Textos con los que los navegadores reportan un fallo de red. Los usamos como
 * red de seguridad para que un "Failed to fetch" crudo no llegue nunca a la UI
 * aunque venga de un fetch que no pasó por el wrapper.
 */
const MENSAJES_DE_RED = [
  'failed to fetch',
  'load failed',
  'networkerror',
  'network request failed',
  'the internet connection appears to be offline',
  'err_internet_disconnected',
  'err_name_not_resolved',
  'err_address_unreachable',
  'err_connection',
  'err_network_changed',
]

/** true si el error es por falta de conexión, venga o no envuelto en NetworkError. */
export function esErrorDeRed(e: unknown): boolean {
  if (e instanceof NetworkError) return true
  const msg = (e instanceof Error ? e.message : String(e ?? '')).toLowerCase()
  return MENSAJES_DE_RED.some((m) => msg.includes(m))
}
