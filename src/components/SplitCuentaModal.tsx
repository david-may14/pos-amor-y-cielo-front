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
import { crearVenta } from '../api/ventas'
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
interface Cuenta { id: string; label: string; metodoPago: MetodoPago; propina: string }
type Containers = Record<string, string[]>

interface Props {
  cart: CartItem[]
  onConfirm: (results: VentaResponse[]) => void
  onClose: () => void
}

const METODOS: MetodoPago[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']
const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const mkId = () => Math.random().toString(36).slice(2, 8)
const UNASSIGNED = 'unassigned'

// ─── Unit card (non-interactive display) ─────────────────────────────────────

function UnitCard({ unit, compact = false, dragging = false }: {
  unit: DragUnit; compact?: boolean; dragging?: boolean
}) {
  const netPrice = unit.precioUnitario - unit.descPerUnit
  return (
    <div className={`rounded-xl border select-none transition-shadow ${
      dragging
        ? 'bg-white border-forest shadow-2xl ring-2 ring-forest/40 rotate-2 scale-105'
        : 'bg-white border-stone-200 shadow-sm'
    } ${compact ? 'px-3 py-2' : 'px-3 py-3'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-stone-800 leading-snug truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {unit.nombre}
          </p>
          {!compact && unit.mods.length > 0 && (
            <p className="text-xs text-stone-400 mt-0.5 truncate">
              {unit.mods.map(m => m.nombre).join(', ')}
            </p>
          )}
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
        {/* drag handle icon */}
        <svg className={`flex-shrink-0 mt-0.5 text-stone-300 ${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`}
          fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <circle cx="9" cy="7" r="1" fill="currentColor" />
          <circle cx="15" cy="7" r="1" fill="currentColor" />
          <circle cx="9" cy="12" r="1" fill="currentColor" />
          <circle cx="15" cy="12" r="1" fill="currentColor" />
          <circle cx="9" cy="17" r="1" fill="currentColor" />
          <circle cx="15" cy="17" r="1" fill="currentColor" />
        </svg>
      </div>
    </div>
  )
}

// ─── Draggable wrapper ────────────────────────────────────────────────────────

function Draggable({ id, unit, compact }: { id: string; unit: DragUnit; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform) || undefined,
    opacity: isDragging ? 0.3 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    touchAction: 'none',
  }
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <UnitCard unit={unit} compact={compact} />
    </div>
  )
}

// ─── Droppable zone ───────────────────────────────────────────────────────────

function DroppableZone({ id, unitIds, unitMap, compact, emptyLabel }: {
  id: string
  unitIds: string[]
  unitMap: Record<string, DragUnit>
  compact?: boolean
  emptyLabel?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl p-2 space-y-2 min-h-28 transition-colors border-2 ${
        isOver
          ? 'bg-green-50 border-forest border-dashed'
          : 'bg-stone-50 border-stone-100 border-dashed'
      }`}
    >
      {unitIds.length === 0 ? (
        <div className="flex items-center justify-center h-20 text-stone-300 text-xs text-center">
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function SplitCuentaModal({ cart, onConfirm, onClose }: Props) {
  const [phase, setPhase] = useState<'choose' | 'split'>('choose')
  const [numPartes, setNumPartes] = useState(2)
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [containers, setContainers] = useState<Containers>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState<string | null>(null)
  const [procesando, setProcesando] = useState(false)
  const [progreso, setProgreso] = useState<string | null>(null)
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
      id: mkId(), label: `Cuenta ${i + 1}`, metodoPago: 'EFECTIVO', propina: '',
    }))
    const init: Containers = { [UNASSIGNED]: [...allUnitIds] }
    cs.forEach(c => { init[c.id] = [] })
    setCuentas(cs)
    setContainers(init)
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
      const u = unitMap[uid]
      byLine[u.lineId] = (byLine[u.lineId] ?? 0) + 1
    })
    return Object.entries(byLine).map(([lineId, cantidad]) => {
      const ci = cart.find(i => i.lineId === lineId)!
      return {
        productoId: ci.productoId,
        cantidad,
        ...(ci.notas ? { notas: ci.notas } : {}),
        ...(ci.mods.length > 0 ? { modificadorOpcionIds: ci.mods.map(m => m.opcionId) } : {}),
        ...(ci.descuento ? { descuentoId: ci.descuento.descuentoId } : {}),
      }
    })
  }

  const handleCobrar = async () => {
    const activas = cuentas.filter(c => (containers[c.id] ?? []).length > 0)
    setProcesando(true)
    setError('')
    const results: VentaResponse[] = []
    try {
      for (const c of activas) {
        setProgreso(c.label)
        const propina = parseFloat(c.propina) || 0
        const venta = await crearVenta(
          buildItems(c.id), c.metodoPago, null,
          propina > 0 ? propina : undefined,
        )
        results.push(venta)
      }
      onConfirm(results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar venta')
      setProcesando(false)
      setProgreso(null)
    }
  }

  const grandTotal = cuentas.reduce((s, c) => s + totalCuenta(c.id) + (parseFloat(c.propina) || 0), 0)

  // ── Phase 1: choose ────────────────────────────────────────────────────────
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
            {[2, 3, 4, 5, 6].map(n => (
              <button
                key={n}
                onClick={() => setNumPartes(n)}
                className={`w-12 h-12 rounded-xl text-lg font-bold border-2 transition-all ${
                  numPartes === n
                    ? 'bg-forest text-cream border-forest scale-110'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-forest/50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={() => initSplit(numPartes)} className="btn-primary flex-1">
              Continuar →
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Phase 2: split — rendered as its own fixed overlay (NOT inside Modal)
  // This avoids overflow-y-auto and stacking-context issues with DragOverlay.
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight: '95dvh', height: '95dvh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPhase('choose')}
              className="text-stone-400 hover:text-stone-700 transition-colors"
              title="Cambiar número de partes"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
            </button>
            <h2 className="text-base font-semibold text-stone-800">Dividir cuenta</h2>
          </div>
          <div className="flex items-center gap-3">
            {unassignedCount > 0 ? (
              <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                {unassignedCount} sin asignar
              </span>
            ) : (
              <span className="text-xs text-green-600 font-semibold">✓ Todo asignado</span>
            )}
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-stone-100 transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-3 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 flex-shrink-0">
            {error}
          </div>
        )}

        {/* DnD area — no overflow wrapper around this */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 flex gap-0 overflow-hidden">

            {/* ── Left: unassigned ── */}
            <div className="w-40 flex-shrink-0 flex flex-col border-r border-stone-100 bg-stone-50/50">
              <div className="px-3 pt-3 pb-2 flex-shrink-0">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Sin asignar</p>
                <p className="text-xs text-stone-400 mt-0.5">Arrastra a una cuenta →</p>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                <DroppableZone
                  id={UNASSIGNED}
                  unitIds={containers[UNASSIGNED] ?? []}
                  unitMap={unitMap}
                  emptyLabel="✓ Todo asignado"
                />
              </div>
            </div>

            {/* ── Right: cuentas ── */}
            <div className="flex-1 flex gap-3 overflow-x-auto p-4">
              {cuentas.map(c => {
                const subtotal = totalCuenta(c.id)
                const propina = parseFloat(c.propina) || 0
                const total = subtotal + propina
                const count = (containers[c.id] ?? []).length
                return (
                  <div key={c.id} className="flex flex-col min-w-44 flex-1 min-h-0">
                    {/* Label */}
                    <div className="flex items-center justify-between mb-2 flex-shrink-0">
                      {editingLabel === c.id ? (
                        <input
                          autoFocus
                          className="text-sm font-semibold text-stone-700 border-b border-forest bg-transparent outline-none w-full"
                          value={c.label}
                          onChange={e => updateCuenta(c.id, { label: e.target.value })}
                          onBlur={() => setEditingLabel(null)}
                          onKeyDown={e => e.key === 'Enter' && setEditingLabel(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingLabel(c.id)}
                          className="text-sm font-semibold text-stone-700 hover:text-forest truncate text-left"
                          title="Clic para renombrar"
                        >
                          {c.label}
                        </button>
                      )}
                      {count > 0 && (
                        <span className="ml-1 bg-forest text-cream text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                          {count}
                        </span>
                      )}
                    </div>

                    {/* Drop zone — capped height, scrolls internally */}
                    <div className="overflow-y-auto flex-shrink-0" style={{ maxHeight: '45vh' }}>
                      <DroppableZone
                        id={c.id}
                        unitIds={containers[c.id] ?? []}
                        unitMap={unitMap}
                        compact
                      />
                    </div>

                    {/* Footer — always visible */}
                    <div className="mt-3 space-y-2 flex-shrink-0">
                      <select
                        value={c.metodoPago}
                        onChange={e => updateCuenta(c.id, { metodoPago: e.target.value as MetodoPago })}
                        className="input text-xs py-1.5 w-full"
                      >
                        {METODOS.map(m => (
                          <option key={m} value={m}>
                            {m === 'EFECTIVO' ? 'Efectivo' : m === 'TARJETA' ? 'Tarjeta' : 'Transfer.'}
                          </option>
                        ))}
                      </select>
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                        <input
                          type="number" min={0} step={1} placeholder="Propina"
                          value={c.propina}
                          onChange={e => updateCuenta(c.id, { propina: e.target.value })}
                          className="input text-xs py-1.5 pl-5 w-full"
                        />
                      </div>
                      <div className={`text-center py-2 rounded-xl text-sm font-bold ${
                        count > 0 ? 'bg-forest text-cream' : 'bg-stone-100 text-stone-300'
                      }`}>
                        {fmt(total)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* DragOverlay renders as a portal to document.body — must be inside DndContext */}
          <DragOverlay dropAnimation={null}>
            {activeId && unitMap[activeId] ? (
              <div style={{ width: '152px', cursor: 'grabbing' }}>
                <UnitCard unit={unitMap[activeId]} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 flex-shrink-0">
          <button
            onClick={handleCobrar}
            disabled={!allAssigned || procesando}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 text-base"
          >
            {procesando ? (
              <>
                <Spinner className="w-4 h-4 text-cream" />
                <span>{progreso ? `Procesando ${progreso}…` : 'Procesando…'}</span>
              </>
            ) : allAssigned ? (
              <span>
                Cobrar {cuentas.filter(c => (containers[c.id] ?? []).length > 0).length} cuentas · {fmt(grandTotal)}
              </span>
            ) : (
              <span className="opacity-60">
                Faltan {unassignedCount} producto{unassignedCount !== 1 ? 's' : ''} por asignar
              </span>
            )}
          </button>
        </div>

      </div>
    </div>
  )
}
