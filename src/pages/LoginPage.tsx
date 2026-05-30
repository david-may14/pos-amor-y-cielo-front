import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sessionExpired = sessionStorage.getItem('session_expired') === '1'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      sessionStorage.removeItem('session_expired')
      navigate('/pos')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* Panel izquierdo — marca */}
      <div className="hidden lg:flex lg:w-5/12 bg-forest-deep flex-col items-center justify-center gap-8 px-12">
        <img
          src="/logo-cream.svg"
          alt="Amor y Cielo"
          style={{ height: '88px', width: 'auto', maxWidth: '210px' }}
        />
        <div className="h-px w-10 bg-cream/20" />
        <p className="text-cream/30 text-xs tracking-[0.18em] uppercase text-center leading-relaxed">
          Mérida, Yucatán<br />Lunes a sábado · 5:30 – 10:00 pm
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 bg-surface flex items-center justify-center p-8">
        <div className="w-full max-w-sm">

          {/* Logo solo en móvil/tablet */}
          <div className="flex justify-center mb-10 lg:hidden">
            <img
              src="/logo-dark.svg"
              alt="Amor y Cielo"
              style={{ height: '56px', width: 'auto', maxWidth: '160px' }}
            />
          </div>

          <h1 className="text-2xl font-semibold text-stone-800 mb-1">
            {sessionExpired ? 'Sesión expirada' : 'Bienvenido'}
          </h1>
          <p className="text-sm text-stone-400 mb-8">
            {sessionExpired
              ? 'Tu sesión cerró automáticamente. Vuelve a iniciar sesión para continuar.'
              : 'Ingresa tus credenciales para continuar.'}
          </p>

          {sessionExpired && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 text-amber-700 text-sm rounded-xl px-4 py-3 mb-6">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              La sesión dura 8 horas (un turno). Ingresa de nuevo para continuar.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 flex items-center justify-center gap-2 !mt-6"
            >
              {loading && <Spinner className="w-4 h-4 text-cream" />}
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>

    </div>
  )
}
