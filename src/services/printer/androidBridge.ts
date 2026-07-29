import { Capacitor, registerPlugin } from '@capacitor/core'

export interface BluetoothDevice {
  name: string
  address: string
}

interface BluetoothClassicPlugin {
  listBonded(): Promise<{ devices: BluetoothDevice[] }>
  connect(options: { address: string }): Promise<void>
  write(options: { address: string; data: string }): Promise<void>
  disconnect(options: { address: string }): Promise<void>
}

// Se resuelve en tiempo de ejecución contra el plugin nativo Kotlin del proyecto
// Capacitor (repo "hybrid"). En un navegador normal (PWA) simplemente no se usa.
const BluetoothClassic = registerPlugin<BluetoothClassicPlugin>('BluetoothClassic')

const STORAGE_KEY = 'pos_printer_bt_address'

export const isAndroidApp = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function getImpresoraGuardada(): string | null {
  return localStorage.getItem(STORAGE_KEY)
}

export async function listarImpresorasEmparejadas(): Promise<BluetoothDevice[]> {
  const { devices } = await BluetoothClassic.listBonded()
  return devices
}

export async function seleccionarImpresora(address: string): Promise<void> {
  await BluetoothClassic.connect({ address })
  localStorage.setItem(STORAGE_KEY, address)
}

export async function printBytesAndroid(bytes: Uint8Array): Promise<void> {
  const address = getImpresoraGuardada()
  if (!address) {
    throw new Error('No hay impresora emparejada. Selecciónala en Configuración.')
  }
  // Reconecta por si el socket se cerró (app en segundo plano, impresora se apagó, etc.)
  await BluetoothClassic.connect({ address }).catch(() => {})
  await BluetoothClassic.write({ address, data: bytesToBase64(bytes) })
}
