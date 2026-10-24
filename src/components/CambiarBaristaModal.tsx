import { useEffect, useState } from 'react'
import Modal from './Modal'
import TecladoPin from './TecladoPin'
import Spinner from './Spinner'
import { useAuth } from '../contexts/AuthContext'
import { useBarista } from '../contexts/BaristaContext'
import type { BaristaDTO } from '../types/api'

const LONGITUD = 6

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
}

/**
 * Cambio rápido de barista: se elige quién atiende y se teclea su PIN. La
 * sesión del equipo no se cierra; solo cambia a nombre de quién quedan las
 * ventas y las propinas.
 */
export default function CambiarBaristaModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { activo, baristas: todos, cambiar, volverASesion } = useBarista()
  // Un admin no atiende: para la barra cada quien usa su cuenta de barista o supervisor.
  const baristas = todos.filter((b) => b.rol !== 'ADMIN')
  const [elegido, setElegido] = useState<BaristaDTO | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    if (!elegido || pin.length !== LONGITUD || verificando) return
    let cancelado = false
    setVerificando(true)
    setError('')
    cambiar(elegido, pin)
      .then(() => { if (!cancelado) onClose() })
      .catch((e: unknown) => {
        if (cancelado) return
        setPin('')
        setError(e instanceof Error ? e.message : 'No se pudo cambiar de barista')
      })
      .finally(() => { if (!cancelado) setVerificando(false) })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const elegir = (b: BaristaDTO) => {
    setElegido(b)
    setPin('')
    setError('')
  }

  return (
    <Modal title={elegido ? `PIN de ${elegido.nombre}` : '¿Quién atiende?'} onClose={onClose} size="sm">
      {!elegido ? (
        <div className="space-y-3">
          {baristas.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-6">
              Nadie puede atender todavía. Cada barista o supervisor crea su PIN al iniciar sesión una vez;
              los administradores no atienden en caja.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {baristas.map((b) => {
                const esActivo = activo?.id === b.id
                return (
                  <button
                    key={b.id}
                    onClick={() => elegir(b)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors ${
                      esActivo
                        ? 'border-forest bg-forest/5'
                        : 'border-stone-200 hover:border-forest/40 hover:bg-stone-50'
                    }`}
                  >
                    <span className="w-11 h-11 rounded-full bg-forest/10 text-forest font-semibold flex items-center justify-center">
                      {iniciales(b.nombre)}
                    </span>
                    <span className="text-sm font-medium text-stone-700 text-center leading-tight">{b.nombre}</span>
                    {esActivo && <span className="text-[11px] text-forest">Atendiendo</span>}
                  </button>
                )
              })}
            </div>
          )}
          {activo && user?.rol !== 'ADMIN' && (
            <button
              onClick={() => { volverASesion(); onClose() }}
              className="w-full text-xs text-stone-400 hover:text-stone-600 pt-2"
            >
              Volver a la sesión de {user?.nombre}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 text-center">
              {error}
            </div>
          )}
          {verificando ? (
            <div className="flex justify-center py-10">
              <Spinner className="w-6 h-6 text-forest" />
            </div>
          ) : (
            <TecladoPin valor={pin} onChange={setPin} longitud={LONGITUD} />
          )}
          <button
            onClick={() => setElegido(null)}
            className="w-full text-xs text-stone-400 hover:text-stone-600"
          >
            ← Elegir a otra persona
          </button>
        </div>
      )}
    </Modal>
  )
}
