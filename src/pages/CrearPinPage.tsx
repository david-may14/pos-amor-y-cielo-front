import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import TecladoPin from '../components/TecladoPin'

const LONGITUD = 6

/**
 * Alta del PIN que permitirá abrir la caja sin internet. Se ofrece tras el
 * primer inicio de sesión; siempre se puede omitir.
 */
export default function CrearPinPage() {
  const { crearPin } = useAuth()
  const navigate = useNavigate()
  const [paso, setPaso] = useState<'nuevo' | 'confirmar'>('nuevo')
  const [primero, setPrimero] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (pin.length !== LONGITUD) return

    if (paso === 'nuevo') {
      setPrimero(pin)
      setPin('')
      setError('')
      setPaso('confirmar')
      return
    }

    if (pin !== primero) {
      setPin('')
      setPrimero('')
      setPaso('nuevo')
      setError('Los PIN no coinciden. Empecemos de nuevo.')
      return
    }

    crearPin(pin)
      .then(() => navigate('/pos', { replace: true }))
      .catch((e: unknown) => {
        setPin('')
        setPrimero('')
        setPaso('nuevo')
        setError(e instanceof Error ? e.message : 'No se pudo guardar el PIN')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-semibold text-stone-800 text-center">
          {paso === 'nuevo' ? 'Crea un PIN' : 'Confírmalo'}
        </h1>
        <p className="text-sm text-stone-400 text-center mb-8">
          {paso === 'nuevo'
            ? `${LONGITUD} dígitos para abrir la caja sin internet.`
            : 'Ingresa el mismo PIN otra vez.'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-6 text-center">
            {error}
          </div>
        )}

        <TecladoPin valor={pin} onChange={setPin} longitud={LONGITUD} />

        <button
          onClick={() => navigate('/pos', { replace: true })}
          className="w-full mt-8 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
