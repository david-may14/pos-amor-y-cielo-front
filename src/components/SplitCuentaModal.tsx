import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { crearVenta, anularVenta } from '../api/ventas'
import type { VentaResponse, MetodoPago } from '../types/api'
import Modal from './Modal'
import Spinner from './Spinner'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartMod { opcionId: number; nombre: string; precioExtra: number }
interface CartDiscount { descuentoId: number; nombre: string; tipo: 'PORCENTAJE' | 'FIJO'; valor: number }
interface CartItem {
  lineId: string; productoId: number; nombre: string; precioUnitario: number
  cantidad: number; notas: string; mods: CartMod[]; descuento: CartDiscount | null
}
interface DragUnit {
  id: string; lineId: string; productoId: number; nombre: string
  precioUnitario: number; descPerUnit: number; mods: CartMod[]
  descuentoId?: number; notas: string
}
interface Cuenta {
  id: string; label: string; metodoPago: MetodoPago
  propina: string; propinaMode: string; recibido: string
}
type Containers = Record<string, string[]>

interface Props {
  cart: CartItem[]
  onConfirm: (results: VentaResponse[]) => void
  onClose: () => void
}

const PROPINA_PRESETS = [10, 20, 50]

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const mkId = () => Math.random().toString(36).slice(2, 8)
const UNASSIGNED = 'unassigned'

// ─── Unit card ────────────────────────────────────────────────────────────────

function UnitCard({ unit, compact = false, dragging = false }: {
  unit: DragUnit; compact?: boolean; dragging?: boolean
}) {
  const netPrice = unit.precioUnitario - unit.descPerUnit
  return (
    <div className={`rounded-xl border select-none ${
      dragging
        ? 'bg-white border-forest shadow-2xl ring-2 ring-forest/40 rotate-2 scale-105'
        : 'bg-white border-stone-200 shadow-sm'
    } ${compact ? 'px-2 py-1.5' : 'px-3 py-2.5'}`}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-stone-800 truncate leading-tight ${compact ? 'text-xs' : 'text-sm'}`}>
            {unit.nombre}
          </p>
          {unit.descPerUnit > 0 ? (
            <p className={`font-semibold mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              <span className="text-forest">{fmt(netPrice)}</span>
              <span className="line-through text-stone-300 ml-1 text-xs font-normal">{fmt(unit.precioUnitario)}</span>
            </p>
          ) : (
            <p className={`text-forest font-semibold mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              {fmt(unit.precioUnitario)}
            </p>
          )}
        </div>
        <svg className="flex-shrink-0 mt-0.5 text-stone-300 w-3 h-3" fill="currentColor" viewBox="0 0 10 16">
          <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
          <circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/>
          <circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/>
        </svg>
      </div>
    </div>
  )
}

// ─── Draggable ────────────────────────────────────────────────────────────────

function Draggable({ id, unit, compact }: { id: string; unit: DragUnit; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform) || undefined,
    opacity: isDragging ? 0.25 : 1,
    touchAction: 'none',
    cursor: isDragging ? 'grabbing' : 'grab',
  }
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <UnitCard unit={unit} compact={compact} />
    </div>
  )
}

// ─── Droppable zone ───────────────────────────────────────────────────────────

function DroppableZone({ id, unitIds, unitMap, compact, emptyLabel }: {
  id: string; unitIds: string[]; unitMap: Record<string, DragUnit>
  compact?: boolean; emptyLabel?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-2 space-y-1.5 border-2 border-dashed transition-colors h-full ${
        isOver ? 'bg-green-50 border-forest' : 'bg-stone-50 border-stone-200'
      }`}
    >
      {unitIds.length === 0 ? (
        <div className="flex items-center justify-center h-full min-h-16 text-stone-300 text-xs">
          {emptyLabel ?? 'Arrastra aquí'}
        </div>
      ) : (
        unitIds.map(uid => (
          <Draggable key={uid} id={uid} unit={unitMap[uid]} compact={compact} />
        ))
      )}
    </div>
  )
}

// ─── Controls per cuenta ──────────────────────────────────────────────────────

function CuentaControls({ cuenta, subtotal, hasItems, pagada, procesando, anulando, onUpdate, onCobrar, onAnular }: {
  cuenta: Cuenta; subtotal: number; hasItems: boolean
  pagada: boolean; procesando: boolean; anulando: boolean
  onUpdate: (p: Partial<Cuenta>) => void
  onCobrar: () => void
  onAnular: () => void
}) {
  const propinaMonto = parseFloat(cuenta.propina) || 0
  const total = subtotal + propinaMonto
  const recibidoMonto = parseFloat(cuenta.recibido) || 0
  const cambio = recibidoMonto - total
  const exacto = Math.ceil(total / 10) * 10 || Math.ceil(total)
  const quickRecibido = [exacto, ...([50, 100, 200, 500].filter(b => b > total))].slice(0, 5)
  const isEfectivo = cuenta.metodoPago === 'EFECTIVO'
  const disabled = procesando

  const puedeAnular = cuenta.metodoPago !== 'TARJETA'

  if (pagada) {
    return (
      <div className="pt-2 border-t border-stone-100 space-y-1.5">
        <div className="flex justify-between items-center px-3 py-2 rounded-xl text-sm font-bold bg-forest text-cream">
          <span className="text-xs font-normal opacity-70">Total cobrado</span>
          <span>{fmt(total)}</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-green-600 text-xs font-semibold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          Pagada
        </div>
        {puedeAnular && (
          <button
            onClick={onAnular}
            disabled={anulando}
            className="w-full py-1.5 rounded-xl text-xs font-medium border border-red-200 text-red-400 hover:bg-red-50 hover:border-red-400 hover:text-red-600 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {anulando ? <><Spinner className="w-3 h-3 text-red-400" /> Anulando…</> : 'Anular cobro'}
          </button>
        )}
        {!puedeAnular && (
          <p className="text-center text-[10px] text-stone-300">No anulable (tarjeta)</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5 pt-2 border-t border-stone-100">
      <select value={cuenta.metodoPago} disabled={disabled}
        onChange={e => onUpdate({ metodoPago: e.target.value as MetodoPago, recibido: '' })}
        className="input text-xs py-1.5 w-full">
        <option value="EFECTIVO">Efectivo</option>
        <option value="TARJETA">Tarjeta</option>
        <option value="TRANSFERENCIA">Transferencia</option>
      </select>

      <select value={cuenta.propinaMode === 'custom' ? 'custom' : cuenta.propinaMode} disabled={disabled}
        onChange={e => {
          const v = e.target.value
          v === 'custom' ? onUpdate({ propinaMode: 'custom', propina: '' }) : onUpdate({ propinaMode: v, propina: v })
        }}
        className="input text-xs py-1.5 w-full">
        <option value="">Sin propina</option>
        {PROPINA_PRESETS.map(v => <option key={v} value={String(v)}>Propina ${v}</option>)}
        <option value="custom">Otra cantidad…</option>
      </select>
      {cuenta.propinaMode === 'custom' && (
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
          <input autoFocus type="number" min={0} step={1} placeholder="0" disabled={disabled}
            value={cuenta.propina} onChange={e => onUpdate({ propina: e.target.value })}
            className="input text-xs py-1.5 pl-5 w-full" />
        </div>
      )}

      {isEfectivo && (
        <select value={cuenta.recibido} disabled={disabled}
          onChange={e => onUpdate({ recibido: e.target.value })}
          className="input text-xs py-1.5 w-full">
          <option value="">Recibido…</option>
          {quickRecibido.map((v, i) => (
            <option key={v} value={String(v)}>{i === 0 ? `Exacto  ${fmt(v)}` : fmt(v)}</option>
          ))}
        </select>
      )}

      {isEfectivo && recibidoMonto > 0 && (
        <div className={`flex justify-between items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
          cambio >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
        }`}>
          <span className="font-normal">{cambio >= 0 ? 'Cambio' : 'Falta'}</span>
          <span>{fmt(Math.abs(cambio))}</span>
        </div>
      )}

      <div className={`flex justify-between items-center px-3 py-2 rounded-xl text-sm font-bold ${
        hasItems ? 'bg-forest text-cream' : 'bg-stone-100 text-stone-300'
      }`}>
        <span className="text-xs font-normal opacity-70">Total</span>
        <span>{fmt(total)}</span>
      </div>

      <button onClick={onCobrar} disabled={!hasItems || disabled}
        className="w-full py-2 rounded-xl text-sm font-semibold border-2 border-forest text-forest hover:bg-forest hover:text-cream transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {procesando ? <><Spinner className="w-3.5 h-3.5 text-forest" /> Procesando…</> : 'Cobrar'}
      </button>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SplitCuentaModal({ cart, onConfirm, onClose }: Props) {
  const [phase, setPhase] = useState<'choose' | 'split'>('choose')
  const [numPartes, setNumPartes] = useState(2)
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [containers, setContainers] = useState<Containers>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [procesandoId, setProcesandoId] = useState<string | null>(null)
  const [anulandoId, setAnulandoId] = useState<string | null>(null)
  const [pagadas, setPagadas] = useState<Record<string, VentaResponse>>({})
  const [splitId, setSplitId] = useState('')
  const [error, setError] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const { unitMap, allUnitIds } = useMemo(() => {
    const units: DragUnit[] = []
    cart.forEach(item => {
      const descPerUnit = item.descuento
        ? item.descuento.tipo === 'PORCENTAJE'
          ? item.precioUnitario * item.descuento.valor / 100
          : item.descuento.valor / item.cantidad
        : 0
      for (let i = 0; i < item.cantidad; i++) {
        units.push({
          id: `${item.lineId}-u${i}`,
          lineId: item.lineId,
          productoId: item.productoId,
          nombre: item.nombre,
          precioUnitario: item.precioUnitario,
          descPerUnit,
          mods: item.mods,
          descuentoId: item.descuento?.descuentoId,
          notas: item.notas,
        })
      }
    })
    const map: Record<string, DragUnit> = {}
    units.forEach(u => { map[u.id] = u })
    return { unitMap: map, allUnitIds: units.map(u => u.id) }
  }, [cart])

  const initSplit = (n: number) => {
    const cs: Cuenta[] = Array.from({ length: n }, (_, i) => ({
      id: mkId(), label: `Cuenta ${i + 1}`,
      metodoPago: 'EFECTIVO', propina: '', propinaMode: '', recibido: '',
    }))
    const init: Containers = { [UNASSIGNED]: [...allUnitIds] }
    cs.forEach(c => { init[c.id] = [] })
    setCuentas(cs)
    setContainers(init)
    setSplitId(crypto.randomUUID())
    setPhase('split')
  }

  const findContainer = (unitId: string) =>
    Object.keys(containers).find(k => containers[k].includes(unitId))

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string)

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) return
    const unitId = active.id as string
    const overId = over.id as string
    const sourceId = findContainer(unitId)
    if (!sourceId) return
    const destId = containers[overId] !== undefined ? overId : findContainer(overId)
    if (!destId || destId === sourceId) return
    setContainers(prev => ({
      ...prev,
      [sourceId]: prev[sourceId].filter(id => id !== unitId),
      [destId]: [...prev[destId], unitId],
    }))
  }

  const updateCuenta = (id: string, patch: Partial<Cuenta>) =>
    setCuentas(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))

  const removeCuenta = () => {
    const last = cuentas[cuentas.length - 1]
    if (!last) return
    const items = containers[last.id] ?? []
    setContainers(prev => {
      const next = { ...prev }
      delete next[last.id]
      next[UNASSIGNED] = [...next[UNASSIGNED], ...items]
      return next
    })
    setCuentas(prev => prev.slice(0, -1))
  }

  const addCuenta = () => {
    const n = cuentas.length + 1
    const nueva: Cuenta = {
      id: mkId(), label: `Cuenta ${n}`,
      metodoPago: 'EFECTIVO', propina: '', propinaMode: '', recibido: '',
    }
    setContainers(prev => ({ ...prev, [nueva.id]: [] }))
    setCuentas(prev => [...prev, nueva])
  }

  const totalCuenta = (cuentaId: string) =>
    (containers[cuentaId] ?? []).reduce((sum, uid) => {
      const u = unitMap[uid]
      return sum + (u.precioUnitario - u.descPerUnit)
    }, 0)

  const unassignedCount = (containers[UNASSIGNED] ?? []).length
  const allAssigned = unassignedCount === 0

  const buildItems = (cuentaId: string) => {
    const byLine: Record<string, number> = {}
    ;(containers[cuentaId] ?? []).forEach(uid => {
      byLine[unitMap[uid].lineId] = (byLine[unitMap[uid].lineId] ?? 0) + 1
    })
    return Object.entries(byLine).map(([lineId, cantidad]) => {
      const ci = cart.find(i => i.lineId === lineId)!
      return {
        productoId: ci.productoId, cantidad,
        ...(ci.notas ? { notas: ci.notas } : {}),
        ...(ci.mods.length > 0 ? { modificadorOpcionIds: ci.mods.map(m => m.opcionId) } : {}),
        ...(ci.descuento ? { descuentoId: ci.descuento.descuentoId } : {}),
      }
    })
  }

  const handleCobrarCuenta = async (c: Cuenta) => {
    if ((containers[c.id] ?? []).length === 0) return
    setProcesandoId(c.id)
    setError('')
    try {
      const propina = parseFloat(c.propina) || 0
      const venta = await crearVenta(
        buildItems(c.id), c.metodoPago, null,
        propina > 0 ? propina : undefined,
        splitId,
      )
      setPagadas(prev => ({ ...prev, [c.id]: venta }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar venta')
    } finally {
      setProcesandoId(null)
    }
  }

  const handleAnularCuenta = async (c: Cuenta) => {
    const venta = pagadas[c.id]
    if (!venta) return
    setAnulandoId(c.id)
    setError('')
    try {
      await anularVenta(venta.id)
      setPagadas(prev => {
        const next = { ...prev }
        delete next[c.id]
        return next
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al anular')
    } finally {
      setAnulandoId(null)
    }
  }

  const asignadas = cuentas.filter(c => (containers[c.id] ?? []).length > 0)
  const cobradas = asignadas.filter(c => pagadas[c.id])
  const todasCobradas = allAssigned && asignadas.length > 0 && cobradas.length === asignadas.length

  // ── Phase 1 ────────────────────────────────────────────────────────────────
  if (phase === 'choose') {
    return (
      <Modal title="Dividir cuenta" onClose={onClose} size="sm">
        <div className="text-center space-y-6 py-4">
          <div>
            <p className="text-stone-600 text-sm font-medium">¿En cuántas partes?</p>
            <p className="text-xs text-stone-400 mt-1">
              {cart.reduce((s, i) => s + i.cantidad, 0)} productos en total
            </p>
          </div>
          <div className="flex justify-center gap-3">
            {Array.from({ length: Math.min(cart.reduce((s, i) => s + i.cantidad, 0), 8) - 1 }, (_, i) => i + 2).map(n => (
              <button key={n} onClick={() => setNumPartes(n)}
                className={`w-12 h-12 rounded-xl text-lg font-bold border-2 transition-all ${
                  numPartes === n
                    ? 'bg-forest text-cream border-forest scale-110'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-forest/50'
                }`}>{n}</button>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => initSplit(numPartes)} className="btn-primary flex-1">Continuar →</button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Phase 2 ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col">
      <div className="bg-white flex flex-col w-full h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setPhase('choose')} className="p-1 text-stone-400 hover:text-stone-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-stone-800">Dividir cuenta</h2>
          </div>
          <div className="flex items-center gap-3">
            {unassignedCount > 0
              ? <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">{unassignedCount} sin asignar</span>
              : <span className="text-xs text-green-600 font-semibold">✓ Todo asignado</span>
            }
            {/* Incremento / reducción de cuentas */}
            <div className="flex items-center gap-1 bg-stone-100 rounded-lg px-1 py-0.5">
              <button
                onClick={removeCuenta}
                disabled={cuentas.length <= 1}
                className="w-7 h-7 rounded-md flex items-center justify-center text-stone-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg font-bold leading-none"
                title="Quitar cuenta"
              >−</button>
              <span className="text-xs font-semibold text-stone-600 w-4 text-center">{cuentas.length}</span>
              <button
                onClick={addCuenta}
                disabled={cuentas.length >= allUnitIds.length}
                className="w-7 h-7 rounded-md flex items-center justify-center text-stone-600 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all text-lg font-bold leading-none"
                title="Agregar cuenta"
              >+</button>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-700 text-2xl leading-none rounded-lg hover:bg-stone-100">×</button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-2 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-2 flex-shrink-0">{error}</div>
        )}

        {/* ── Main area: sin asignar (fixed left) + cuentas (horizontal scroll) ── */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex overflow-hidden">

            {/* Left: sin asignar — fixed column, no scroll horizontally */}
            <div className="w-40 flex-shrink-0 flex flex-col border-r border-stone-100 bg-stone-50">
              <div className="px-3 pt-3 pb-1 flex-shrink-0">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Sin asignar</p>
                <p className="text-[10px] text-stone-400 mt-0.5">Arrastra a una cuenta →</p>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <DroppableZone
                  id={UNASSIGNED}
                  unitIds={containers[UNASSIGNED] ?? []}
                  unitMap={unitMap}
                  emptyLabel="✓ Listo"
                />
              </div>
            </div>

            {/* Right: cuenta columns — horizontal scroll, each column has drop zone + controls */}
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <div className="flex gap-3 p-3 h-full" style={{ minWidth: `${cuentas.length * 192}px` }}>
                {cuentas.map(c => {
                  const count = (containers[c.id] ?? []).length
                  return (
                    <div key={c.id} className="flex flex-col w-48 flex-shrink-0">

                      {/* Column header */}
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-stone-700 truncate">{c.label}</p>
                        {count > 0 && (
                          <span className="ml-1 bg-forest text-cream text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                            {count}
                          </span>
                        )}
                      </div>

                      {/* Drop zone — fixed height, scrolls if many items */}
                      <div className="overflow-y-auto flex-shrink-0" style={{ height: '40vh', minHeight: '140px' }}>
                        <DroppableZone
                          id={c.id}
                          unitIds={containers[c.id] ?? []}
                          unitMap={unitMap}
                          compact
                        />
                      </div>

                      {/* Controls — right below the drop zone, always aligned */}
                      <CuentaControls
                        cuenta={c}
                        subtotal={totalCuenta(c.id)}
                        hasItems={count > 0}
                        pagada={!!pagadas[c.id]}
                        procesando={procesandoId === c.id}
                        anulando={anulandoId === c.id}
                        onUpdate={patch => updateCuenta(c.id, patch)}
                        onCobrar={() => handleCobrarCuenta(c)}
                        onAnular={() => handleAnularCuenta(c)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeId && unitMap[activeId] ? (
              <div style={{ width: '148px', cursor: 'grabbing' }}>
                <UnitCard unit={unitMap[activeId]} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-stone-100 flex-shrink-0 flex items-center gap-3">
          {todasCobradas ? (
            <button
              onClick={() => onConfirm(Object.values(pagadas))}
              className="btn-primary flex-1 py-3 text-base font-semibold flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Finalizar — todas las cuentas cobradas
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-between">
              {unassignedCount > 0 ? (
                <span className="text-xs text-amber-600 font-medium">
                  {unassignedCount} producto{unassignedCount !== 1 ? 's' : ''} sin asignar
                </span>
              ) : (
                <span className="text-xs text-stone-400">
                  {cobradas.length} de {asignadas.length} cuenta{asignadas.length !== 1 ? 's' : ''} cobrada{asignadas.length !== 1 ? 's' : ''}
                </span>
              )}
              <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-600 underline ml-4">
                Cancelar
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
