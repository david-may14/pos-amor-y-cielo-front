import { useState, useEffect } from 'react'
import {
  listarImpresorasEmparejadas, seleccionarImpresora, getImpresoraGuardada,
  type BluetoothDevice,
} from '../services/printer/androidBridge'
import Spinner from './Spinner'

export default function ImpresoraAndroidCard() {
  const [dispositivos, setDispositivos] = useState<BluetoothDevice[]>([])
  const [seleccionada, setSeleccionada] = useState<string | null>(getImpresoraGuardada())
  const [buscando, setBuscando] = useState(false)
  const [conectando, setConectando] = useState<string | null>(null)
  const [error, setError] = useState('')

  const buscar = async () => {
    setBuscando(true)
    setError('')
    try {
      setDispositivos(await listarImpresorasEmparejadas())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener la lista de dispositivos')
    } finally {
      setBuscando(false)
    }
  }

  useEffect(() => { buscar() }, [])

  const conectar = async (address: string) => {
    setConectando(address)
    setError('')
    try {
      await seleccionarImpresora(address)
      setSeleccionada(address)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo conectar a la impresora')
    } finally {
      setConectando(null)
    }
  }

  return (
    <div className="mt-6 card px-6 py-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-stone-800">Impresora Bluetooth</h2>
        <button
          onClick={buscar}
          disabled={buscando}
          className="text-xs text-stone-400 hover:text-forest transition-colors"
        >
          {buscando ? 'Buscando…' : 'Actualizar'}
        </button>
      </div>
      <p className="text-xs text-stone-400 mb-4">
        Primero empareja la impresora desde los ajustes de Bluetooth de Android (PIN 1234), luego
        selecciónala aquí.
      </p>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-3">{error}</p>
      )}

      {buscando ? (
        <div className="flex justify-center py-6">
          <Spinner className="w-5 h-5 text-forest" />
        </div>
      ) : dispositivos.length === 0 ? (
        <p className="text-sm text-stone-400 py-4 text-center">
          No hay dispositivos Bluetooth emparejados con esta tablet.
        </p>
      ) : (
        <div className="space-y-2">
          {dispositivos.map((d) => {
            const activa = seleccionada === d.address
            return (
              <button
                key={d.address}
                onClick={() => conectar(d.address)}
                disabled={conectando === d.address}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                  activa
                    ? 'bg-forest/10 border-forest text-forest'
                    : 'bg-white border-stone-200 text-stone-700 hover:border-forest/40'
                }`}
              >
                <div className="text-left">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-stone-400">{d.address}</p>
                </div>
                {conectando === d.address ? (
                  <Spinner className="w-4 h-4" />
                ) : activa ? (
                  <span className="text-xs font-semibold">Seleccionada</span>
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
