import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { autorizarSupervisor, cambiarBarista, listarBaristas } from '../api/pin'
import { esErrorDeRed } from '../api/errores'
import {
  getBaristaActivo, setBaristaActivo, getBaristasGuardados, guardarBaristas,
  recordarPin, verificarPinLocal,
} from '../db/baristaActivo'
import CambiarBaristaModal from '../components/CambiarBaristaModal'
import type { BaristaDTO } from '../types/api'

interface BaristaContextValue {
  /** Quien atiende ahora; null = el usuario de la sesión. */
  activo: BaristaDTO | null
  /** Nombre a mostrar: el barista activo o, si no hay, el de la sesión. */
  nombreActivo: string
  /** Lo que se manda con cada venta y comanda. null deja que decida la sesión. */
  atendioUsuarioId: number | null
  baristas: BaristaDTO[]
  /** Valida el PIN (con el servidor, o en el equipo si no hay red) y pasa la caja. */
  cambiar: (b: BaristaDTO, pin: string) => Promise<void>
  /** Comprueba el PIN de un supervisor o admin. Lanza si no es válido. */
  autorizar: (b: BaristaDTO, pin: string) => Promise<void>
  /** Si quien atiende ya es supervisor o admin y no hace falta pedir PIN. */
  puedeAutorizar: boolean
  volverASesion: () => void
  abrirSelector: () => void
}

const BaristaContext = createContext<BaristaContextValue | null>(null)

export function BaristaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  // Un admin guardado de una versión anterior no cuenta: los admin no atienden.
  const [activo, setActivo] = useState<BaristaDTO | null>(() => {
    const b = getBaristaActivo()
    return b && b.rol !== 'ADMIN' ? b : null
  })
  const [baristas, setBaristas] = useState<BaristaDTO[]>(() => getBaristasGuardados())
  const [selectorAbierto, setSelectorAbierto] = useState(false)

  // Al bloquear o cerrar sesión, la caja vuelve a quien entre después.
  useEffect(() => {
    if (!user) {
      setActivo(null)
      setBaristaActivo(null)
    }
  }, [user])

  const cargarBaristas = useCallback(async () => {
    try {
      const lista = await listarBaristas()
      setBaristas(lista)
      guardarBaristas(lista)
    } catch {
      // sin red se queda la última lista conocida
    }
  }, [])

  useEffect(() => { if (user) cargarBaristas() }, [user, cargarBaristas])

  const fijar = useCallback((b: BaristaDTO | null) => {
    setActivo(b)
    setBaristaActivo(b)
  }, [])

  /** Valida con el servidor; sin red, contra lo que recuerda el equipo. */
  const comprobar = useCallback(async (
    b: BaristaDTO, pin: string, enServidor: (id: number, pin: string) => Promise<BaristaDTO>,
  ): Promise<BaristaDTO> => {
    try {
      const confirmado = await enServidor(b.id, pin)
      await recordarPin(b.id, pin)
      return confirmado
    } catch (e) {
      if (!esErrorDeRed(e)) throw e
      const local = await verificarPinLocal(b.id, pin)
      if (local === 'ok') return b
      if (local === 'incorrecto') throw new Error('PIN incorrecto')
      throw new Error(`Sin conexión: ${b.nombre} tiene que entrar una vez con internet en este equipo.`)
    }
  }, [])

  const cambiar = useCallback(async (b: BaristaDTO, pin: string) => {
    fijar(await comprobar(b, pin, cambiarBarista))
  }, [comprobar, fijar])

  const autorizar = useCallback(async (b: BaristaDTO, pin: string) => {
    if (b.rol === 'BARISTA') throw new Error('Solo un supervisor puede autorizarlo')
    await comprobar(b, pin, autorizarSupervisor)
  }, [comprobar])

  // Solo cuenta quien entró con su PIN: la sesión del equipo puede ser de un
  // admin y la estaría usando cualquiera.
  const rolActivo = activo?.rol

  const volverASesion = useCallback(() => fijar(null), [fijar])

  const abrirSelector = useCallback(() => {
    cargarBaristas()
    setSelectorAbierto(true)
  }, [cargarBaristas])

  return (
    <BaristaContext.Provider value={{
      activo,
      nombreActivo: activo?.nombre ?? user?.nombre ?? '',
      atendioUsuarioId: activo?.id ?? null,
      baristas,
      cambiar, autorizar,
      puedeAutorizar: rolActivo === 'ADMIN' || rolActivo === 'SUPERVISOR',
      volverASesion, abrirSelector,
    }}>
      {children}
      {selectorAbierto && <CambiarBaristaModal onClose={() => setSelectorAbierto(false)} />}
    </BaristaContext.Provider>
  )
}

export function useBarista(): BaristaContextValue {
  const ctx = useContext(BaristaContext)
  if (!ctx) throw new Error('useBarista must be inside BaristaProvider')
  return ctx
}
