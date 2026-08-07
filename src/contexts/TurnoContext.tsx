import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { obtenerTurnoActivoOffline } from '../api/turnos'
import { invalidarCache } from '../api/client'
import { precargarCatalogo } from '../db/precargaCatalogo'
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

    // Abrir turno es el momento de refrescar el catálogo: durante el servicio
    // el POS lee todo de la copia local para que tocar un producto sea
    // inmediato, así que esta es la ventana en la que se recogen los cambios
    // hechos entre turnos.
    //
    // Se vuelve a bajar en vez de solo invalidar: borrar dejaría el caché vacío
    // y el primer toque de cada producto pagaría su viaje a la red, con un
    // cliente enfrente. Aquí no hay nadie esperando.
    if (t && t.estado === 'ABIERTO') {
      invalidarCache('modificadores:')
        .then(() => invalidarCache('descuentoAplicable:'))
        .then(() => precargarCatalogo())
        .catch(() => {
          // Sin red se sigue con lo que ya había: es preferible operar con el
          // catálogo de ayer que no poder abrir la caja.
        })
    }
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
