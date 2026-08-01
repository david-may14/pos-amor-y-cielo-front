import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { obtenerTurnoActivoOffline } from '../api/turnos'
import { offlineDb } from '../db/offlineDb'
import type { TurnoDTO } from '../types/api'
import { useAuth } from './AuthContext'

const CACHE_KEY = 'turnoActivo'

interface TurnoContextValue {
  turno: TurnoDTO | null
  /** true mientras se resuelve la primera consulta tras iniciar sesión. */
  loading: boolean
  refrescarTurno: () => Promise<void>
  /** Actualiza el turno tras abrirlo/cerrarlo/registrar un movimiento, sin
   * esperar otra petición: esas acciones ya devuelven el turno resultante. */
  actualizarTurno: (t: TurnoDTO | null) => void
}

const TurnoContext = createContext<TurnoContextValue | null>(null)

export function TurnoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [turno, setTurno] = useState<TurnoDTO | null>(null)
  const [loading, setLoading] = useState(true)

  const refrescarTurno = useCallback(async () => {
    try {
      setTurno(await obtenerTurnoActivoOffline())
    } catch {
      setTurno(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) refrescarTurno()
    else setLoading(false)
  }, [user, refrescarTurno])

  const actualizarTurno = useCallback((t: TurnoDTO | null) => {
    setTurno(t)
    offlineDb.cache.put({ key: CACHE_KEY, data: t, actualizadoEn: new Date().toISOString() }).catch(() => {})
  }, [])

  return (
    <TurnoContext.Provider value={{ turno, loading, refrescarTurno, actualizarTurno }}>
      {children}
    </TurnoContext.Provider>
  )
}

export function useTurno(): TurnoContextValue {
  const ctx = useContext(TurnoContext)
  if (!ctx) throw new Error('useTurno must be inside TurnoProvider')
  return ctx
}
