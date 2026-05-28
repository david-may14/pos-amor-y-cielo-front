import { useState, useEffect, useCallback } from 'react'
import { listarGastos, crearGasto, actualizarGasto, eliminarGasto, obtenerEquilibrio } from '../api/equilibrio'
import type { GastoFijoDTO, EquilibrioDTO } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export default function EquilibrioPage() {
  const [gastos, setGastos] = useState<GastoFijoDTO[]>([])
  const [equilibrio, setEquilibrio] = useState<EquilibrioDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<GastoFijoDTO | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formMonto, setFormMonto] = useState('')
  const [formActivo, setFormActivo] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [g, e] = await Promise.all([listarGastos(), obtenerEquilibrio()])
      setGastos(g)
      setEquilibrio(e)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const openNuevo = () => {
    setEditing(null)
    setFormNombre('')
    setFormMonto('')
    setFormActivo(true)
    setFormError('')
    setShowModal(true)
  }

  const openEditar = (g: GastoFijoDTO) => {
    setEditing(g)
    setFormNombre(g.nombre)
    setFormMonto(String(g.monto))
    setFormActivo(g.activo)
    setFormError('')
    setShowModal(true)
  }

  const handleGuardar = async () => {
    const monto = parseFloat(formMonto)
    if (!formNombre.trim()) { setFormError('El nombre es requerido'); return }
    if (isNaN(monto) || monto < 0) { setFormError('El monto debe ser mayor o igual a 0'); return }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        const updated = await actualizarGasto(editing.id, { nombre: formNombre.trim(), monto, activo: formActivo })
        setGastos((prev) => prev.map((g) => g.id === editing.id ? updated : g))
      } else {
        const nuevo = await crearGasto({ nombre: formNombre.trim(), monto })
        setGastos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      }
      const e = await obtenerEquilibrio()
      setEquilibrio(e)
      setShowModal(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await eliminarGasto(editing.id)
      setGastos((prev) => prev.filter((g) => g.id !== editing.id))
      const e = await obtenerEquilibrio()
      setEquilibrio(e)
      setShowModal(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  const mesActual = new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner className="w-8 h-8 text-forest" /></div>
  }

  const pct = equilibrio?.porcentaje ?? 0
  const faltante = equilibrio?.faltante ?? 0
  const totalGastos = equilibrio?.totalGastosFijos ?? 0
  const ingresos = equilibrio?.ingresosDelMes ?? 0
  const metaVentas = equilibrio?.metaVentas ?? 0
  const margenBruto = equilibrio?.margenBruto ?? 0
  const alcanzado = faltante === 0 && totalGastos > 0

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Punto de equilibrio</h1>
          <p className="text-sm text-stone-400 mt-0.5 capitalize">{mesActual}</p>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {/* Progress card */}
      <div className={`card p-6 mb-4 ${alcanzado ? 'border-emerald-200 bg-emerald-50' : ''}`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-stone-500">Ventas del mes</p>
            <p className={`text-3xl font-bold mt-0.5 ${alcanzado ? 'text-emerald-700' : 'text-stone-800'}`}>
              {fmt(ingresos)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-stone-500">Meta de ventas</p>
            <p className="text-xl font-semibold text-stone-600 mt-0.5">{fmt(metaVentas)}</p>
            {totalGastos > 0 && margenBruto > 0 && (
              <p className="text-xs text-stone-400 mt-0.5">{fmt(totalGastos)} ÷ {margenBruto.toFixed(1)}%</p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-stone-100 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-500 ${alcanzado ? 'bg-emerald-500' : 'bg-forest'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={`font-medium ${alcanzado ? 'text-emerald-700' : 'text-forest'}`}>
            {pct}% completado
          </span>
          {alcanzado ? (
            <span className="text-emerald-600 font-semibold">Punto de equilibrio alcanzado</span>
          ) : (
            <span className="text-stone-500">Faltan <strong className="text-stone-700">{fmt(faltante)}</strong> en ventas</span>
          )}
        </div>
      </div>

      {/* Breakdown chips */}
      {equilibrio && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card p-4 text-center">
            <p className="text-xs text-stone-400 mb-1">Gastos fijos</p>
            <p className="font-semibold text-stone-800">{fmt(totalGastos)}</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-stone-400 mb-1">Margen bruto</p>
            <p className="font-semibold text-stone-800">{margenBruto > 0 ? `${margenBruto.toFixed(1)}%` : '—'}</p>
            <p className="text-xs text-stone-300 mt-0.5">este mes</p>
          </div>
          <div className="card p-4 text-center">
            <p className="text-xs text-stone-400 mb-1">Meta de ventas</p>
            <p className="font-semibold text-stone-800">{totalGastos > 0 && margenBruto > 0 ? fmt(metaVentas) : '—'}</p>
          </div>
        </div>
      )}

      {/* Gastos fijos */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-stone-700">Gastos fijos mensuales</h2>
        <button onClick={openNuevo} className="btn-primary flex items-center gap-1.5 text-sm py-2">
          <span className="text-base leading-none">+</span> Agregar
        </button>
      </div>

      {gastos.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-14 text-center">
          <svg className="w-10 h-10 text-stone-200 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          <p className="text-stone-400 text-sm">Sin gastos fijos registrados</p>
          <p className="text-stone-300 text-xs mt-1">Agrega renta, sueldos, servicios…</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Concepto</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Monto</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {gastos.map((g) => (
                <tr key={g.id} className={`hover:bg-surface-muted/50 ${!g.activo ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-stone-800">{g.nombre}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-stone-700">{fmt(g.monto)}</td>
                  <td className="px-5 py-3">
                    {g.activo
                      ? <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                      : <span className="text-xs bg-stone-100 text-stone-400 px-2 py-0.5 rounded-full">Inactivo</span>
                    }
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEditar(g)} className="text-xs text-forest hover:underline">Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-stone-100 bg-stone-50">
                <td className="px-5 py-3 text-xs font-semibold text-stone-500 uppercase">Total activos</td>
                <td className="px-5 py-3 text-right font-bold text-stone-800 tabular-nums">{fmt(totalGastos)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={editing ? `Editar — ${editing.nombre}` : 'Nuevo gasto fijo'}
          onClose={() => setShowModal(false)}
          size="sm"
        >
          <div className="space-y-4">
            {formError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
            <div>
              <label className="label">Concepto</label>
              <input
                className="input"
                placeholder="Renta, sueldos, luz…"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                autoFocus
                disabled={saving}
              />
            </div>
            <div>
              <label className="label">Monto mensual (MXN)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={formMonto}
                onChange={(e) => setFormMonto(e.target.value)}
                disabled={saving}
              />
            </div>
            {editing && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activo-chk"
                  checked={formActivo}
                  onChange={(e) => setFormActivo(e.target.checked)}
                  disabled={saving}
                  className="w-4 h-4 accent-forest"
                />
                <label htmlFor="activo-chk" className="text-sm text-stone-600">Incluir en el cálculo</label>
              </div>
            )}
            <div className="flex gap-3 pt-1">
              {editing && (
                <button onClick={handleEliminar} disabled={saving} className="btn-secondary text-red-500 hover:bg-red-50">
                  Eliminar
                </button>
              )}
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button
                onClick={handleGuardar}
                disabled={saving}
                className="btn-primary flex-1 flex justify-center gap-2"
              >
                {saving && <Spinner className="w-4 h-4 text-cream" />}
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
