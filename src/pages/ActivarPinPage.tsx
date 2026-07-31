import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import TecladoPin from '../components/TecladoPin'
import Spinner from '../components/Spinner'
import { esErrorDeRed } from '../api/client'

const LONGITUD = 6

/**
 * El usuario ya tiene PIN en el servidor pero este dispositivo aún no está
 * armado. Al teclearlo se verifica contra el servidor y se cifra con él la
 * sesión local, que es lo que permitirá entrar después sin internet.
 *
 * No se inventa un PIN nuevo: es el mismo de siempre, en cualquier equipo.
 */
export default function ActivarPinPage() {
  const { activarPin, user } = useAuth()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    if (pin.length !== LONGITUD || verificando) return

    setVerificando(true)
    setError('')
    activarPin(pin)
      .then(() => navigate('/pos', { replace: true }))
      .catch((e: unknown) => {
        setPin('')
        if (esErrorDeRed(e)) {
          setError('Sin conexión. Necesitas internet solo para activarlo esta vez.')
        } else {
          setError(e instanceof Error ? e.message : 'No se pudo activar el PIN')
        }
      })
      .finally(() => setVerificando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-semibold text-stone-800 text-center">
          {user ? `Hola, ${user.nombre}` : 'Activar este equipo'}
        </h1>
        <p className="text-sm text-stone-400 text-center mb-8">
          Ingresa tu PIN para poder abrir la caja sin internet en este equipo.
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-6 text-center">
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
          onClick={() => navigate('/pos', { replace: true })}
          className="w-full mt-8 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Ahora no
        </button>
      </div>
    </div>
  )
}
