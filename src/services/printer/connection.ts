export function isSerialSupported(): boolean {
  return 'serial' in navigator
}

let cachedPort: SerialPort | null = null

/**
 * Devuelve el puerto de la impresora. Si el usuario ya la emparejó antes en
 * este navegador, lo reusa sin pedir permiso de nuevo; si no, abre el picker
 * nativo (debe llamarse desde un gesto del usuario, ej. un click).
 */
async function getPrinterPort(): Promise<SerialPort> {
  if (cachedPort) return cachedPort

  const known = await navigator.serial.getPorts()
  cachedPort = known[0] ?? await navigator.serial.requestPort()
  return cachedPort
}

export async function printBytes(bytes: Uint8Array): Promise<void> {
  if (!isSerialSupported()) {
    throw new Error('Este navegador no soporta impresión por Bluetooth (Web Serial no disponible).')
  }

  const port = await getPrinterPort()
  if (!port.writable) {
    await port.open({ baudRate: 9600 })
  }

  const writer = port.writable!.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
}

/** Olvida la impresora emparejada, por si hay que conectar una distinta. */
export async function forgetPrinter(): Promise<void> {
  if (cachedPort) {
    await cachedPort.forget?.()
    cachedPort = null
  }
}
