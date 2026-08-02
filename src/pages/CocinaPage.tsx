import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  estadoCocina, iniciarComanda, marcarComandaLista, revertirComanda, CocinaError,
} from '../api/cocina'
import { esErrorDeRed } from '../api/errores'
import type { ComandaCocina, EstadoCocina } from '../types/api'
import ElapsedSince from '../components/ElapsedSince'
import Modal from '../components/Modal'
import TecladoPin from '../components/TecladoPin'
import Spinner from '../components/Spinner'

/**
 * Pantalla de cocina. Se abre desde el login sin iniciar sesión y se queda
 * puesta todo el día en la tablet de la barra.
 *
 * No monta el Layout de la app: no hay usuario, así que la barra lateral con
 * navegación y cierre de sesión no tendría sentido ni a dónde llevar.
 */

/** Cada cuánto se vuelve a preguntar por comandas nuevas. */
const REFRESCO_MS = 6000

const VACIO: EstadoCocina = { turnoAbierto: false, pendientes: [], entregadas: [] }

export default function CocinaPage() {
  const [estado, setEstado] = useState<EstadoCocina>(VACIO)
  const [cargando, setCargando] = useState(true)
  const [sinConexion, setSinConexion] = useState(false)
  /** Fallo del servidor, no de la red. Se distingue porque se arreglan distinto. */
  const [fallo, setFallo] = useState('')
  const [aRevertir, setARevertir] = useState<ComandaCocina | null>(null)
  /** Ids con una acción en vuelo, para no dispararla dos veces de un toque doble. */
  const [ocupados, setOcupados] = useState<number[]>([])

  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  const refrescar = useCallback(async () => {
    try {
      const datos = await estadoCocina()
      if (!montado.current) return
      setEstado(datos)
      setSinConexion(false)
      setFallo('')
    } catch (e) {
      if (!montado.current) return
      // Sin red se deja en pantalla lo último que se supo: en media barra es
      // más útil una lista de hace un minuto que una pantalla en blanco.
      if (esErrorDeRed(e)) setSinConexion(true)
      else {
        // Un error del servidor no puede quedar mudo: sin esto, un backend sin
        // la ruta desplegada se vería igual que una barra sin turno abierto, y
        // se perdería media mañana buscando el turno que sí estaba abierto.
        setFallo(e instanceof Error ? e.message : 'Error del servidor')
      }
    } finally {
      if (montado.current) setCargando(false)
    }
  }, [])

  useEffect(() => {
    refrescar()
    const id = setInterval(() => {
      // Con la tablet bloqueada o en otra pestaña no hay nadie mirando; seguir
      // sondeando solo gastaría batería y datos.
      if (document.visibilityState === 'visible') refrescar()
    }, REFRESCO_MS)

    const alVolver = () => { if (document.visibilityState === 'visible') refrescar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [refrescar])

  const conBloqueo = async (id: number, accion: () => Promise<unknown>) => {
    if (ocupados.includes(id)) return
    setOcupados(prev => [...prev, id])
    try {
      await accion()
      await refrescar()
    } catch (e) {
      if (esErrorDeRed(e)) setSinConexion(true)
      else await refrescar() // el estado cambió por debajo: relee la verdad
    } finally {
      if (montado.current) setOcupados(prev => prev.filter(x => x !== id))
    }
  }

  const porHacer = estado.pendientes.filter(c => c.estadoPreparacion === 'PENDIENTE')
  const enProceso = estado.pendientes.filter(c => c.estadoPreparacion === 'EN_PROCESO')

  if (cargando) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <Spinner className="w-8 h-8 text-forest" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-forest-deep text-cream px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-baseline gap-3">
          <h1 className="text-lg font-semibold">Cocina</h1>
          {sinConexion && (
            <span className="text-xs text-amber-300">
              Sin conexión · mostrando lo último recibido
            </span>
          )}
        </div>
        <Link to="/login" className="text-xs text-cream/70 hover:text-cream underline">
          Salir
        </Link>
      </header>

      {fallo ? (
        <Fallo mensaje={fallo} onReintentar={refrescar} />
      ) : !estado.turnoAbierto ? (
        <SinTurno />
      ) : (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-y-auto">
          <Columna titulo="Por preparar" vacio="Nada pendiente" comandas={porHacer}>
            {c => (
              <button
                className="btn-primary w-full py-3 text-base"
                disabled={ocupados.includes(c.id)}
                onClick={() => conBloqueo(c.id, () => iniciarComanda(c.id))}
              >
                Empezar
              </button>
            )}
          </Columna>

          <Columna titulo="En proceso" vacio="Nada en la barra" comandas={enProceso}>
            {c => (
              <button
                className="btn-primary w-full py-3 text-base"
                disabled={ocupados.includes(c.id)}
                onClick={() => conBloqueo(c.id, () => marcarComandaLista(c.id))}
              >
                Marcar lista
              </button>
            )}
          </Columna>

          {estado.entregadas.length > 0 && (
            <section className="lg:col-span-2">
              <h2 className="text-sm font-medium text-stone-500 mb-2">
                Entregadas en este turno
              </h2>
              <div className="flex flex-wrap gap-2">
                {estado.entregadas.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setARevertir(c)}
                    className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm text-stone-600 hover:border-forest hover:text-forest transition-colors"
                    title="Devolver a preparación"
                  >
                    {etiqueta(c)} · {c.listoEn && <ElapsedSince iso={c.listoEn} />}
                  </button>
                ))}
              </div>
            </section>
          )}
        </main>
      )}

      {aRevertir && (
        <ModalRevertir
          comanda={aRevertir}
          onCerrar={() => setARevertir(null)}
          onHecho={async () => { setARevertir(null); await refrescar() }}
        />
      )}
    </div>
  )
}

function Fallo({ mensaje, onReintentar }: { mensaje: string; onReintentar: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p className="text-lg font-medium text-stone-700">No se pudieron cargar las comandas</p>
        <p className="text-sm text-stone-500 mt-2 break-words">{mensaje}</p>
        <button onClick={onReintentar} className="btn-primary mt-5 px-6 py-2">
          Reintentar
        </button>
      </div>
    </div>
  )
}

function SinTurno() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <p className="text-lg font-medium text-stone-700">No hay turno abierto</p>
        <p className="text-sm text-stone-500 mt-2">
          Las comandas aparecen aquí cuando alguien abre la caja.
        </p>
      </div>
    </div>
  )
}

interface ColumnaProps {
  titulo: string
  vacio: string
  comandas: ComandaCocina[]
  children: (c: ComandaCocina) => React.ReactNode
}

function Columna({ titulo, vacio, comandas, children }: ColumnaProps) {
  return (
    <section className="flex flex-col min-w-0">
      <h2 className="text-sm font-medium text-stone-500 mb-2">
        {titulo} {comandas.length > 0 && <span className="text-stone-400">({comandas.length})</span>}
      </h2>
      {comandas.length === 0 ? (
        <p className="text-sm text-stone-400 py-8 text-center">{vacio}</p>
      ) : (
        <div className="space-y-3">
          {comandas.map(c => (
            <Tarjeta key={c.id} comanda={c}>{children(c)}</Tarjeta>
          ))}
        </div>
      )}
    </section>
  )
}

function Tarjeta({ comanda, children }: { comanda: ComandaCocina; children: React.ReactNode }) {
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-stone-800 truncate">{etiqueta(comanda)}</h3>
          <p className="text-xs text-stone-400">
            <ElapsedSince iso={comanda.creadoEn} />
          </p>
        </div>
        {comanda.cobrada && (
          // Quien ya pagó está esperando de pie: conviene que salte a la vista.
          <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-forest/10 text-forest whitespace-nowrap">
            Pagada
          </span>
        )}
      </div>

      <ul className="space-y-2 mb-4">
        {comanda.items.map(item => (
          <li key={item.id} className="text-stone-700">
            <span className="font-medium">{item.cantidad}×</span> {item.nombreProducto}
            {item.modificadores.length > 0 && (
              <span className="block text-sm text-stone-500 pl-5">
                {item.modificadores.join(' · ')}
              </span>
            )}
            {item.notas && (
              // La nota es lo que más se pasa por alto y lo que más devoluciones
              // causa; por eso va destacada y no en gris como el resto.
              <span className="block text-sm text-amber-700 pl-5">{item.notas}</span>
            )}
          </li>
        ))}
      </ul>

      {children}
    </article>
  )
}

function ModalRevertir({ comanda, onCerrar, onHecho }: {
  comanda: ComandaCocina
  onCerrar: () => void
  onHecho: () => void | Promise<void>
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const enviar = async (valor: string) => {
    setEnviando(true)
    setError('')
    try {
      await revertirComanda(comanda.id, valor)
      await onHecho()
    } catch (e) {
      setPin('')
      if (esErrorDeRed(e)) setError('Sin conexión')
      else if (e instanceof CocinaError && e.status === 429) {
        setError('Demasiados intentos. Espera unos minutos.')
      } else setError(e instanceof Error ? e.message : 'No se pudo revertir')
    } finally {
      setEnviando(false)
    }
  }

  // Se manda solo al completar los 6 dígitos: en la barra nadie quiere buscar
  // un botón de confirmar con las manos ocupadas.
  const cambiar = (v: string) => {
    setPin(v)
    if (v.length === 6) enviar(v)
  }

  return (
    <Modal title={`Devolver ${etiqueta(comanda)} a preparación`} onClose={onCerrar} size="sm">
      <p className="text-sm text-stone-500 mb-5 text-center">
        Hace falta el PIN de un administrador.
      </p>
      <TecladoPin valor={pin} onChange={cambiar} disabled={enviando} />
      {enviando && (
        <div className="flex justify-center mt-4">
          <Spinner className="w-5 h-5 text-forest" />
        </div>
      )}
      {error && <p className="text-sm text-red-600 text-center mt-4">{error}</p>}
    </Modal>
  )
}

/** Nombre con el que se llama la orden en la barra. */
function etiqueta(c: ComandaCocina): string {
  return c.nombre?.trim() || `Comanda #${c.id}`
}
