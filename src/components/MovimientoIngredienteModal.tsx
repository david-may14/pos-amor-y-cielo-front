import { useState, useMemo, useRef } from 'react'
import { registrarCompra, registrarAjuste } from '../api/inventario'
import { obtenerSubreceta, producirIngrediente } from '../api/ingredientes'
import type { Ingrediente, IngredienteBasico, MovimientoInventario, SubrecetaDTO } from '../types/api'
import { MOVIMIENTOS, OPERACIONES, operacionesPara, deltaPrevisto, redondear, type Operacion } from '../utils/inventario'
import Modal from './Modal'
import Spinner from './Spinner'

interface Props {
  ingrediente: IngredienteBasico | Ingrediente
  isAdmin: boolean
  /** Movimientos ya cargados por la pagina; se filtran los de este ingrediente. */
  movimientos: MovimientoInventario[]
  onCerrar: () => void
  /** La pagina recarga y avisa; el modal no sabe de toasts ni de listas. */
  onRegistrado: (mensaje: string) => void
}

const ULTIMOS_MOVIMIENTOS = 3

/**
 * Todo lo que se le puede hacer a un ingrediente, con el ingrediente ya
 * elegido.
 *
 * Antes cada operacion era una pestaña que empezaba pidiendo el insumo en un
 * desplegable de 68. El orden estaba al reves: primero se busca lo que se tiene
 * enfrente —en la tabla de Stock, donde se ve cuanto hay— y despues se decide
 * que hacerle.
 *
 * No hay operacion preseleccionada. Un movimiento de inventario no se deshace
 * con un boton, y el radio que viniera marcado por omision seria el que se
 * guarda cuando alguien solo escribe un numero y le da Enter.
 */
export default function MovimientoIngredienteModal({
  ingrediente, isAdmin, movimientos, onCerrar, onRegistrado,
}: Props) {
  const [operacion, setOperacion] = useState<Operacion | null>(null)
  const [cantidad, setCantidad] = useState('')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [subreceta, setSubreceta] = useState<SubrecetaDTO | null>(null)
  const [cargandoSubreceta, setCargandoSubreceta] = useState(false)
  const cantidadRef = useRef<HTMLInputElement>(null)

  const tieneSubreceta = (ingrediente as Ingrediente).rendimientoLote != null
  const disponibles = operacionesPara({ isAdmin, tieneSubreceta })
  const def = operacion ? OPERACIONES[operacion] : null

  const recientes = useMemo(
    () => movimientos.filter((m) => m.ingredienteId === ingrediente.id).slice(0, ULTIMOS_MOVIMIENTOS),
    [movimientos, ingrediente.id]
  )

  const elegirOperacion = async (clave: Operacion) => {
    setOperacion(clave)
    setCantidad('')
    setError('')
    // El campo ya esta montado, asi que autoFocus no vuelve a dispararse: sin
    // esto hay que ir a buscarlo con el dedo despues de elegir la operacion.
    setTimeout(() => cantidadRef.current?.focus(), 0)
    if (clave === 'PRODUCIR') {
      setCantidad('1')
      if (!subreceta) {
        setCargandoSubreceta(true)
        try {
          setSubreceta(await obtenerSubreceta(ingrediente.id))
        } catch {
          setError('No se pudo cargar la sub-receta')
        } finally {
          setCargandoSubreceta(false)
        }
      }
    }
  }

  /** Antes/despues, con la misma regla que aplica el backend. */
  const vistaPrevia = useMemo(() => {
    if (!operacion) return null
    const num = parseFloat(cantidad)
    if (Number.isNaN(num)) return null

    const delta = operacion === 'PRODUCIR'
      ? (subreceta?.rendimientoLote ?? 0) * num
      : deltaPrevisto(operacion, num, ingrediente.stockActual)

    return {
      antes: redondear(ingrediente.stockActual),
      despues: redondear(ingrediente.stockActual + delta),
    }
  }, [operacion, cantidad, subreceta, ingrediente.stockActual])

  const guardar = async () => {
    if (!operacion || !def) { setError('Elige qué quieres registrar'); return }
    const num = parseFloat(cantidad)
    if (Number.isNaN(num)) { setError('Escribe una cantidad'); return }
    if (operacion === 'PRODUCIR' && num <= 0) { setError('Los lotes deben ser mayores que 0'); return }

    setGuardando(true)
    setError('')
    try {
      const { envio } = def
      if (envio.via === 'compra') {
        await registrarCompra([{ ingredienteId: ingrediente.id, cantidad: num, ...(nota ? { nota } : {}) }])
        onRegistrado(`Compra de ${ingrediente.nombre} registrada`)
      } else if (envio.via === 'ajuste') {
        await registrarAjuste({
          ingredienteId: ingrediente.id,
          cantidad: num,
          tipo: envio.tipo,
          modo: envio.modo,
          ...(nota ? { nota } : {}),
        })
        onRegistrado(operacion === 'MERMA' ? 'Merma registrada' : 'Stock corregido')
      } else {
        await producirIngrediente(ingrediente.id, num)
        onRegistrado(`Producción de ${ingrediente.nombre} registrada`)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar')
      setGuardando(false)
    }
  }

  return (
    <Modal title={ingrediente.nombre} onClose={onCerrar}>
      <div className="space-y-5">
        <div className="flex items-baseline justify-between bg-surface-muted rounded-xl px-4 py-3">
          <span className="text-sm text-stone-500">Stock actual</span>
          <span className={`text-lg font-semibold tabular-nums ${
            ingrediente.stockActual <= ingrediente.stockMinimo ? 'text-amber-600' : 'text-stone-800'
          }`}>
            {ingrediente.stockActual} {ingrediente.unidad}
          </span>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

        <div>
          <label className="label">Qué quieres registrar</label>
          <div className="space-y-1.5">
            {disponibles.map((clave) => (
              <label
                key={clave}
                className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                  operacion === clave ? 'border-forest bg-forest/5' : 'border-stone-200 hover:bg-surface-muted'
                }`}
              >
                <input
                  type="radio"
                  name="operacion-movimiento"
                  className="mt-0.5 accent-forest"
                  checked={operacion === clave}
                  onChange={() => elegirOperacion(clave)}
                />
                <span>
                  <span className="block text-sm font-medium text-stone-700">{OPERACIONES[clave].etiqueta}</span>
                  <span className="block text-xs text-stone-500">{OPERACIONES[clave].ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {def && (
          <div>
            <label className="label">{def.etiquetaCantidad}</label>
            <input
              className="input"
              type="number"
              {...(def.permiteNegativo ? {} : { min: '0' })}
              step="0.01"
              placeholder="0.00"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              ref={cantidadRef}
              autoFocus
            />
            {vistaPrevia && (
              <p className="text-xs text-stone-500 mt-1.5">
                {vistaPrevia.antes} →{' '}
                <span className={`font-medium ${vistaPrevia.despues < 0 ? 'text-red-600' : 'text-forest'}`}>
                  {vistaPrevia.despues} {ingrediente.unidad}
                </span>
                {vistaPrevia.despues < 0 && ' — queda en negativo'}
              </p>
            )}
          </div>
        )}

        {operacion === 'PRODUCIR' && cargandoSubreceta && (
          <div className="flex justify-center py-3"><Spinner className="w-5 h-5 text-forest" /></div>
        )}

        {operacion === 'PRODUCIR' && subreceta && subreceta.lineas.length > 0 && (
          <div className="bg-surface-muted rounded-xl p-4 space-y-1">
            <p className="text-xs font-medium text-stone-500 uppercase">Resumen de producción</p>
            {subreceta.lineas.map((l) => (
              <div key={l.baseId} className="flex justify-between text-sm">
                <span className="text-stone-600">{l.baseNombre}</span>
                <span className="text-red-600 font-medium tabular-nums">
                  −{redondear(l.cantidad * (parseFloat(cantidad) || 0))} {l.baseUnidad}
                </span>
              </div>
            ))}
            <div className="flex justify-between text-sm border-t border-stone-200 pt-1 mt-1">
              <span className="text-stone-600 font-medium">{ingrediente.nombre}</span>
              <span className="text-green-600 font-medium tabular-nums">
                +{redondear((subreceta.rendimientoLote ?? 0) * (parseFloat(cantidad) || 0))} {subreceta.unidad}
              </span>
            </div>
          </div>
        )}

        {def && def.envio.via !== 'produccion' && (
          <div>
            <label className="label">Nota (opcional)</label>
            <input
              className="input"
              placeholder={operacion === 'COMPRA' ? 'Proveedor, lote…' : 'Motivo…'}
              value={nota}
              onChange={(e) => setNota(e.target.value)}
            />
          </div>
        )}

        {recientes.length > 0 && (
          <div className="border-t border-stone-100 pt-4">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">
              Últimos movimientos
            </p>
            <ul className="space-y-1.5">
              {recientes.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-md whitespace-nowrap ${
                    MOVIMIENTOS[m.tipo]?.clase ?? 'bg-stone-100 text-stone-600'
                  }`}>
                    {MOVIMIENTOS[m.tipo]?.etiqueta ?? m.tipo}
                  </span>
                  <span className={`font-medium tabular-nums ${
                    m.cantidad < 0 ? 'text-red-600' : m.cantidad > 0 ? 'text-forest' : 'text-stone-500'
                  }`}>
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </span>
                  <span className="text-stone-400 ml-auto whitespace-nowrap">
                    {new Date(m.creadoEn).toLocaleDateString('es-MX', { dateStyle: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCerrar} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando || !operacion || cantidad === ''}
            className="btn-primary flex-1 flex justify-center items-center gap-2"
          >
            {guardando && <Spinner className="w-4 h-4 text-cream" />}
            {guardando ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
