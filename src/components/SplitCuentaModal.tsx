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
type Containers = Record<string, string[]>  // containerId → unitId[]

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function UnitCard({ unit, compact = false }: { unit: DragUnit; compact?: boolean }) {
  const netPrice = unit.precioUnitario - unit.descPerUnit
  return (
    <div className={`bg-white rounded-xl border border-stone-200 shadow-sm select-none ${compact ? 'px-3 py-2' : 'px-3 py-3'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`font-medium text-stone-800 leading-snug truncate ${compact ? 'text-xs' : 'text-sm'}`}>
            {unit.nombre}
          </p>
          {!compact && unit.mods.length > 0 && (
            <p className="text-xs text-stone-400 mt-0.5 truncate">
              {unit.mods.map(m => m.nombre).join(', ')}
            </p>
          )}
          {unit.descPerUnit > 0 ? (
            <p className={`text-forest font-semibold mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              {fmt(netPrice)}
              <span className="line-through text-stone-300 ml-1 font-normal">{fmt(unit.precioUnitario)}</span>
            </p>
          ) : (
            <p className={`text-forest font-semibold mt-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
              {fmt(unit.precioUnitario)}
            </p>
          )}
        </div>
        <svg className="w-3.5 h-3.5 text-stone-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5M3.75 15h16.5" />
        </svg>
      </div>
    </div>
  )
}

function Draggable({ id, unit, compact }: { id: string; unit: DragUnit; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
      <UnitCard unit={unit} compact={compact} />
    </div>
  )
}

function DroppableZone({ id, unitIds, unitMap, compact, empty }: {
  id: string; unitIds: string[]; unitMap: Record<string, DragUnit>; compact?: boolean; empty?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-h-[120px] rounded-xl transition-colors p-2 space-y-2 ${
        isOver ? 'bg-forest/8 ring-2 ring-forest/30' : 'bg-surface-muted/50'
      }`}
    >
      {unitIds.length === 0
        ? (empty ?? (
          <div className="h-full flex items-center justify-center text-stone-300 text-xs text-center py-4">
            Arrastra aquí
          </div>
        ))
        : unitIds.map(uid => (
          <Draggable key={uid} id={uid} unit={unitMap[uid]} compact={compact} />
        ))
      }
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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  // Build expanded units from cart (one per quantity unit)
  const { units, unitMap, allUnitIds } = useMemo(() => {
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
    const unitMap: Record<string, DragUnit> = {}
    units.forEach(u => { unitMap[u.id] = u })
    return { units, unitMap, allUnitIds: units.map(u => u.id) }
  }, [cart])

  // Initialize split phase
  const initSplit = (n: number) => {
    const cs: Cuenta[] = Array.from({ length: n }, (_, i) => ({
      id: mkId(),
      label: `Cuenta ${i + 1}`,
      metodoPago: 'EFECTIVO',
      propina: '',
    }))
    const cs_init: Containers = { [UNASSIGNED]: [...allUnitIds] }
    cs.forEach(c => { cs_init[c.id] = [] })
    setCuentas(cs)
    setContainers(cs_init)
    setPhase('split')
  }

  // Find which container holds a unit
  const findContainer = (unitId: string) =>
    Object.keys(containers).find(k => containers[k].includes(unitId))

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string)
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (!over) return
    const unitId = active.id as string
    const overId = over.id as string

    const sourceId = findContainer(unitId)
    if (!sourceId) return

    // Target can be a container ID or a unit ID (dropped on another card)
    const destId = containers[overId] !== undefined
      ? overId
      : findContainer(overId)

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
    const unitIds = containers[cuentaId] ?? []
    const byLine: Record<string, number> = {}
    unitIds.forEach(uid => {
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
          buildItems(c.id),
          c.metodoPago,
          null,
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
            <p className="text-xs text-stone-400 mt-1">{cart.reduce((s, i) => s + i.cantidad, 0)} productos en total</p>
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
            <button
              onClick={() => initSplit(numPartes)}
              className="btn-primary flex-1"
            >
              Continuar
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Phase 2: split ─────────────────────────────────────────────────────────
  return (
    <Modal title="Dividir cuenta" onClose={onClose} size="xl">
      <div className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <p className="text-xs text-stone-400">
          Arrastra cada producto al grupo correspondiente. Puedes mover entre cuentas libremente.
        </p>

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3" style={{ minHeight: '380px' }}>

            {/* ── Left: unassigned ── */}
            <div className="w-44 flex-shrink-0 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Sin asignar</p>
                {unassignedCount > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {unassignedCount}
                  </span>
                )}
                {allAssigned && (
                  <span className="text-green-500 text-xs font-semibold">✓ Listo</span>
                )}
              </div>
              <DroppableZone
                id={UNASSIGNED}
                unitIds={containers[UNASSIGNED] ?? []}
                unitMap={unitMap}
                empty={
                  <div className="h-full flex flex-col items-center justify-center text-green-400 py-6 gap-2">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                    </svg>
                    <span className="text-xs">Todo asignado</span>
                  </div>
                }
              />
            </div>

            {/* ── Right: cuentas ── */}
            <div className="flex-1 flex gap-3 overflow-x-auto pb-1">
              {cuentas.map(c => {
                const subtotal = totalCuenta(c.id)
                const propina = parseFloat(c.propina) || 0
                const total = subtotal + propina
                const count = (containers[c.id] ?? []).length
                return (
                  <div key={c.id} className="flex flex-col min-w-[160px] flex-1">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      {editingLabel === c.id ? (
                        <input
                          autoFocus
                          className="text-xs font-semibold text-stone-700 border-b border-forest bg-transparent outline-none w-full"
                          value={c.label}
                          onChange={e => updateCuenta(c.id, { label: e.target.value })}
                          onBlur={() => setEditingLabel(null)}
                          onKeyDown={e => e.key === 'Enter' && setEditingLabel(null)}
                        />
                      ) : (
                        <button
                          onClick={() => setEditingLabel(c.id)}
                          className="text-xs font-semibold text-stone-600 hover:text-forest transition-colors text-left truncate"
                          title="Clic para renombrar"
                        >
                          {c.label}
                        </button>
                      )}
                      {count > 0 && (
                        <span className="ml-1 bg-forest/10 text-forest text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          {count}
                        </span>
                      )}
                    </div>

                    {/* Drop zone */}
                    <DroppableZone
                      id={c.id}
                      unitIds={containers[c.id] ?? []}
                      unitMap={unitMap}
                      compact
                    />

                    {/* Footer */}
                    <div className="mt-2 space-y-1.5 px-0.5">
                      <select
                        value={c.metodoPago}
                        onChange={e => updateCuenta(c.id, { metodoPago: e.target.value as MetodoPago })}
                        className="input text-xs py-1 w-full"
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
                          className="input text-xs py-1 pl-5 w-full"
                        />
                      </div>
                      <div className={`text-center py-1.5 rounded-lg text-sm font-bold ${
                        count > 0 ? 'bg-forest/10 text-forest' : 'bg-stone-50 text-stone-300'
                      }`}>
                        {fmt(total)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Drag overlay: floating card while dragging */}
          <DragOverlay>
            {activeId && unitMap[activeId] ? (
              <div className="rotate-2 scale-105 shadow-xl opacity-95">
                <UnitCard unit={unitMap[activeId]} />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-1 border-t border-stone-100">
          <button
            onClick={() => setPhase('choose')}
            className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            ← Cambiar partes
          </button>
          <button
            onClick={handleCobrar}
            disabled={!allAssigned || procesando}
            className="btn-primary flex items-center gap-2 px-6"
          >
            {procesando ? (
              <>
                <Spinner className="w-4 h-4 text-cream" />
                <span>{progreso ? `Procesando ${progreso}…` : 'Procesando…'}</span>
              </>
            ) : (
              <span>
                {allAssigned
                  ? `Cobrar ${cuentas.filter(c => (containers[c.id] ?? []).length > 0).length} cuentas · ${fmt(grandTotal)}`
                  : `Faltan ${unassignedCount} producto${unassignedCount !== 1 ? 's' : ''} por asignar`}
              </span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
