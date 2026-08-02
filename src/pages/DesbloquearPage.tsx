import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import TecladoPin from '../components/TecladoPin'
import Spinner from '../components/Spinner'
import { perfilDelPin } from '../db/pinSesion'

const LONGITUD = 6

/**
 * Desbloqueo con PIN. Es la pantalla que permite volver a entrar a la caja
 * sin internet: descifra el refresh token guardado en el dispositivo.
 */
export default function DesbloquearPage() {
  const { desbloquear, hayPin } = useAuth()
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [nombre, setNombre] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [verificando, setVerificando] = useState(false)

  useEffect(() => {
    perfilDelPin().then((p) => setNombre(p?.nombre ?? null)).catch(() => {})
  }, [])

  useEffect(() => {
    if (hayPin === false) navigate('/login', { replace: true })
  }, [hayPin, navigate])

  useEffect(() => {
    if (pin.length !== LONGITUD || verificando) return

    let cancelado = false
    setVerificando(true)
    setError('')

    desbloquear(pin)
      .then((res) => {
        if (cancelado) return
        if (res.ok) {
          navigate('/pos', { replace: true })
          return
        }
        setPin('')
        if (res.motivo === 'pin-incorrecto') {
          setError(`PIN incorrecto. Te quedan ${res.intentosRestantes} intento${res.intentosRestantes !== 1 ? 's' : ''}.`)
        } else if (res.motivo === 'bloqueado') {
          setError('Demasiados intentos. Tendrás que iniciar sesión con tu contraseña.')
        } else {
          setError('No hay ningún PIN guardado en este dispositivo.')
        }
      })
      .catch(() => {
        if (!cancelado) {
          setPin('')
          setError('No se pudo verificar el PIN.')
        }
      })
      .finally(() => { if (!cancelado) setVerificando(false) })

    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <div className="flex justify-center mb-8">
          <img src="/logo-dark.svg" alt="Amor y Cielo" style={{ height: '48px', width: 'auto' }} />
        </div>

        <h1 className="text-xl font-semibold text-stone-800 text-center">
          {nombre ? `Hola, ${nombre}` : 'Desbloquear'}
        </h1>
        <p className="text-sm text-stone-400 text-center mb-8">
          Ingresa tu PIN para abrir la caja. Funciona sin internet.
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
          onClick={() => navigate('/login')}
          className="w-full mt-8 text-xs text-stone-400 hover:text-stone-600 transition-colors"
        >
          Olvidé mi PIN — entrar con contraseña (requiere internet)
        </button>
      </div>
    </div>
  )
}
