import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import TecladoPin from '../components/TecladoPin'
import Spinner from '../components/Spinner'

const LONGITUD = 6

/**
 * Alta del PIN. Queda guardado en el servidor ligado al usuario, así que
 * sirve en cualquier tablet o teléfono y no hay que inventarlo otra vez al
 * cerrar sesión.
 *
 * El servidor exige la contraseña para confirmar identidad. Normalmente llega
 * desde el login (en memoria, nunca se guarda); si se entra por otra vía se
 * pide aquí.
 */
export default function CrearPinPage() {
  const { crearPin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const passwordDelLogin = (location.state as { password?: string } | null)?.password
  const [password, setPassword] = useState(passwordDelLogin ?? '')
  const [passwordConfirmada, setPasswordConfirmada] = useState(!!passwordDelLogin)

  const [paso, setPaso] = useState<'nuevo' | 'confirmar'>('nuevo')
  const [primero, setPrimero] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (pin.length !== LONGITUD || guardando) return

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

    setGuardando(true)
    crearPin(pin, password)
      .then(() => navigate('/pos', { replace: true }))
      .catch((e: unknown) => {
        setPin('')
        setPrimero('')
        setPaso('nuevo')
        setError(e instanceof Error ? e.message : 'No se pudo guardar el PIN')
      })
      .finally(() => setGuardando(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const confirmarPassword = (e: FormEvent) => {
    e.preventDefault()
    if (!password) return
    setPasswordConfirmada(true)
  }

  if (!passwordConfirmada) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <form onSubmit={confirmarPassword} className="w-full max-w-xs">
          <h1 className="text-xl font-semibold text-stone-800 text-center">Crea un PIN</h1>
          <p className="text-sm text-stone-400 text-center mb-8">
            Confirma tu contraseña para continuar.
          </p>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoFocus
          />
          <button type="submit" className="btn-primary w-full py-3 mt-4">Continuar</button>
          <button
            type="button"
            onClick={() => navigate('/pos', { replace: true })}
            className="w-full mt-6 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Ahora no
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-semibold text-stone-800 text-center">
          {paso === 'nuevo' ? 'Crea un PIN' : 'Confírmalo'}
        </h1>
        <p className="text-sm text-stone-400 text-center mb-8">
          {paso === 'nuevo'
            ? `${LONGITUD} dígitos para abrir la caja sin internet. Será el mismo en cualquier equipo.`
            : 'Ingresa el mismo PIN otra vez.'}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-6 text-center">
            {error}
          </div>
        )}

        {guardando ? (
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
