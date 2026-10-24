import { useEffect, useState } from 'react'
import Modal from './Modal'
import TecladoPin from './TecladoPin'
import Spinner from './Spinner'
import { useBarista } from '../contexts/BaristaContext'
import type { BaristaDTO } from '../types/api'

const LONGITUD = 6

interface Props {
  /** Quien tiene la propina ahora. */
  actualId: number | null
  onConfirm: (b: BaristaDTO) => void
  onClose: () => void
}

/**
 * Pasa la propina de una comanda a otra persona (p. ej. quien la tomó ya se
 * fue y otro terminó de atender). Lo autoriza un supervisor con su PIN; si
 * quien atiende ya es supervisor, no se le vuelve a pedir.
 */
export default function ReasignarPropinaModal({ actualId, onConfirm, onClose }: Props) {
  const { baristas, autorizar, puedeAutorizar } = useBarista()
  const [destino, setDestino] = useState<BaristaDTO | null>(null)
  const [supervisor, setSupervisor] = useState<BaristaDTO | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [verificando, setVerificando] = useState(false)

  const supervisores = baristas.filter((b) => b.rol === 'ADMIN' || b.rol === 'SUPERVISOR')

  const elegirDestino = (b: BaristaDTO) => {
    if (puedeAutorizar) {
      onConfirm(b)
      onClose()
      return
    }
    setDestino(b)
  }

  useEffect(() => {
    if (!destino || !supervisor || pin.length !== LONGITUD || verificando) return
    let cancelado = false
    setVerificando(true)
    setError('')
    autorizar(supervisor, pin)
      .then(() => {
        if (cancelado) return
        onConfirm(destino)
        onClose()
      })
      .catch((e: unknown) => {
        if (cancelado) return
        setPin('')
        setError(e instanceof Error ? e.message : 'No se pudo autorizar')
      })
      .finally(() => { if (!cancelado) setVerificando(false) })
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const titulo = !destino
    ? '¿Para quién es la propina?'
    : !supervisor ? 'Autoriza un supervisor' : `PIN de ${supervisor.nombre}`

  const lista = (items: BaristaDTO[], onPick: (b: BaristaDTO) => void, marcadoId: number | null) => (
    <div className="grid grid-cols-2 gap-2">
      {items.map((b) => (
        <button
          key={b.id}
          onClick={() => onPick(b)}
          className={`rounded-xl border p-3 text-sm font-medium text-stone-700 transition-colors ${
            b.id === marcadoId ? 'border-forest bg-forest/5' : 'border-stone-200 hover:border-forest/40 hover:bg-stone-50'
          }`}
        >
          {b.nombre}
        </button>
      ))}
    </div>
  )

  return (
    <Modal title={titulo} onClose={onClose} size="sm">
      {!destino ? (
        lista(baristas, elegirDestino, actualId)
      ) : !supervisor ? (
        <div className="space-y-3">
          <p className="text-sm text-stone-500">La propina pasará a <b>{destino.nombre}</b>.</p>
          {supervisores.length === 0
            ? <p className="text-sm text-stone-500 text-center py-4">No hay supervisores con PIN.</p>
            : lista(supervisores, (b) => { setSupervisor(b); setPin(''); setError('') }, null)}
          <button onClick={() => setDestino(null)} className="w-full text-xs text-stone-400 hover:text-stone-600">
            ← Elegir a otra persona
          </button>
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
          <button onClick={() => setSupervisor(null)} className="w-full text-xs text-stone-400 hover:text-stone-600">
            ← Elegir a otro supervisor
          </button>
        </div>
      )}
    </Modal>
  )
}
