import { useState, useEffect, useCallback } from 'react'
import { listarIngredientes, crearIngrediente, actualizarIngrediente, obtenerSubreceta, guardarSubreceta, eliminarSubreceta, exportarIngredientes } from '../api/ingredientes'
import { registrarAjuste } from '../api/inventario'
import type { Ingrediente, SubrecetaDTO, IngImportResult } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import ImportarIngredientesModal from '../components/ImportarIngredientesModal'
import PreciosIngredienteModal from '../components/PreciosIngredienteModal'

const UNIDADES = [
  { value: 'g',     label: 'g — gramos' },
  { value: 'kg',    label: 'kg — kilogramos' },
  { value: 'oz',    label: 'oz — onzas (peso)' },
  { value: 'lb',    label: 'lb — libras' },
  { value: 'ml',    label: 'ml — mililitros' },
  { value: 'L',     label: 'L — litros' },
  { value: 'fl oz', label: 'fl oz — onzas fluidas' },
  { value: 'pz',    label: 'pz — pieza' },
  { value: 'paq',   label: 'paq — paquete' },
]

interface IngredienteForm {
  nombre: string
  unidad: string
  stockInicial: string  // solo al crear
  stockActual: string   // solo al editar
  stockMinimo: string
  costoUnitario: string
}

const emptyForm = (): IngredienteForm => ({
  nombre: '',
  unidad: 'g',
  stockInicial: '',
  stockActual: '',
  stockMinimo: '',
  costoUnitario: '',
})

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export default function IngredientesPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [busqueda, setBusqueda] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Ingrediente | null>(null)
  const [form, setForm] = useState<IngredienteForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<IngImportResult | null>(null)
  const [preciosIng, setPreciosIng] = useState<Ingrediente | null>(null)

  // Sub-receta
  const [showSubreceta, setShowSubreceta] = useState(false)
  const [subrecetaIng, setSubrecetaIng] = useState<Ingrediente | null>(null)
  const [subrecetaIngId, setSubrecetaIngId] = useState('')
  const [subreceta, setSubreceta] = useState<SubrecetaDTO | null>(null)
  const [subrecetaLoading, setSubrecetaLoading] = useState(false)
  const [subrecetaError, setSubrecetaError] = useState('')
  const [subrecetaSaving, setSubrecetaSaving] = useState(false)
  const [srRendimiento, setSrRendimiento] = useState('')
  const [srLineas, setSrLineas] = useState<{ baseId: string; cantidad: string; merma: string }[]>([{ baseId: '', cantidad: '', merma: '' }])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      setIngredientes(await listarIngredientes())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const openNuevaSubreceta = () => {
    setSubrecetaIng(null)
    setSubrecetaIngId('')
    setSubreceta(null)
    setSubrecetaError('')
    setSrRendimiento('')
    setSrLineas([{ baseId: '', cantidad: '', merma: '' }])
    setShowSubreceta(true)
  }

  const openSubreceta = async (ing: Ingrediente) => {
    setSubrecetaIng(ing)
    setSubrecetaIngId(String(ing.id))
    setSubrecetaError('')
    setSubrecetaLoading(true)
    setShowSubreceta(true)
    try {
      const data = await obtenerSubreceta(ing.id)
      setSubreceta(data)
      setSrRendimiento(data.rendimientoLote != null ? String(data.rendimientoLote) : '')
      setSrLineas(data.lineas.length > 0
        ? data.lineas.map(l => ({ baseId: String(l.baseId), cantidad: String(l.cantidad), merma: String(l.mermaPorcentaje ?? 0) }))
        : [{ baseId: '', cantidad: '', merma: '' }])
    } catch (e: unknown) {
      setSubrecetaError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setSubrecetaLoading(false)
    }
  }

  const handleSeleccionarIngSubreceta = async (id: string) => {
    setSubrecetaIngId(id)
    if (!id) { setSubrecetaIng(null); setSubreceta(null); setSrRendimiento(''); setSrLineas([{ baseId: '', cantidad: '', merma: '' }]); return }
    const ing = ingredientes.find(i => i.id === parseInt(id))
    if (!ing) return
    setSubrecetaIng(ing)
    setSubrecetaLoading(true)
    setSubrecetaError('')
    try {
      const data = await obtenerSubreceta(ing.id)
      setSubreceta(data)
      setSrRendimiento(data.rendimientoLote != null ? String(data.rendimientoLote) : '')
      setSrLineas(data.lineas.length > 0
        ? data.lineas.map(l => ({ baseId: String(l.baseId), cantidad: String(l.cantidad), merma: String(l.mermaPorcentaje ?? 0) }))
        : [{ baseId: '', cantidad: '', merma: '' }])
    } catch {
      setSubreceta(null)
      setSrRendimiento('')
      setSrLineas([{ baseId: '', cantidad: '', merma: '' }])
    } finally {
      setSubrecetaLoading(false)
    }
  }

  const handleGuardarSubreceta = async () => {
    if (!subrecetaIng) { setSubrecetaError('Selecciona un ingrediente'); return }
    const rendimiento = parseFloat(srRendimiento)
    if (isNaN(rendimiento) || rendimiento <= 0) { setSubrecetaError('Rendimiento por lote debe ser > 0'); return }
    const lineasValidas = srLineas.filter(l => l.baseId && l.cantidad)
    if (lineasValidas.length === 0) { setSubrecetaError('Agrega al menos un ingrediente base'); return }
    setSubrecetaSaving(true)
    setSubrecetaError('')
    try {
      await guardarSubreceta(subrecetaIng.id, {
        rendimientoLote: rendimiento,
        lineas: lineasValidas.map(l => ({ baseId: parseInt(l.baseId), cantidad: parseFloat(l.cantidad), mermaPorcentaje: parseFloat(l.merma) || 0 })),
      })
      setIngredientes(prev => prev.map(i => i.id === subrecetaIng.id ? { ...i, rendimientoLote: rendimiento } : i))
      setShowSubreceta(false)
    } catch (e: unknown) {
      setSubrecetaError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubrecetaSaving(false)
    }
  }

  const handleEliminarSubreceta = async () => {
    if (!subrecetaIng) return
    setSubrecetaSaving(true)
    try {
      await eliminarSubreceta(subrecetaIng.id)
      setIngredientes(prev => prev.map(i => i.id === subrecetaIng.id ? { ...i, rendimientoLote: null } : i))
      setShowSubreceta(false)
    } catch (e: unknown) {
      setSubrecetaError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setSubrecetaSaving(false)
    }
  }

  const ingredientesFiltrados = busqueda.trim()
    ? ingredientes.filter((i) => i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : ingredientes

  const stockBajos = ingredientes.filter((i) => i.stockActual <= i.stockMinimo)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (ing: Ingrediente) => {
    setEditing(ing)
    setForm({
      nombre: ing.nombre,
      unidad: ing.unidad,
      stockInicial: '',
      stockActual: String(ing.stockActual),
      stockMinimo: String(ing.stockMinimo),
      costoUnitario: String(ing.costoUnitario),
    })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    const nombre = form.nombre.trim()
    if (!nombre) { setFormError('El nombre es requerido'); return }
    if (!form.unidad) { setFormError('Selecciona una unidad'); return }

    const stockMinimo = parseFloat(form.stockMinimo)
    const costoUnitario = parseFloat(form.costoUnitario)
    if (isNaN(stockMinimo) || stockMinimo < 0) { setFormError('Stock mínimo debe ser ≥ 0'); return }
    if (isNaN(costoUnitario) || costoUnitario < 0) { setFormError('Costo unitario debe ser ≥ 0'); return }

    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        const nuevoStock = parseFloat(form.stockActual)
        if (isNaN(nuevoStock) || nuevoStock < 0) { setFormError('Stock actual debe ser ≥ 0'); setSaving(false); return }
        const delta = nuevoStock - editing.stockActual
        if (Math.abs(delta) > 0.0001) {
          await registrarAjuste({ ingredienteId: editing.id, cantidad: delta, tipo: 'AJUSTE', nota: 'Corrección de stock' })
        }
        const updated = await actualizarIngrediente(editing.id, {
          nombre, unidad: form.unidad, stockMinimo, costoUnitario,
        })
        setIngredientes((prev) => prev.map((i) => i.id === editing.id ? { ...updated, stockActual: nuevoStock } : i))
      } else {
        const stockInicial = form.stockInicial !== '' ? parseFloat(form.stockInicial) : 0
        if (isNaN(stockInicial) || stockInicial < 0) { setFormError('Stock inicial debe ser ≥ 0'); setSaving(false); return }
        const created = await crearIngrediente({
          nombre, unidad: form.unidad, stockMinimo, costoUnitario, stockInicial,
        })
        setIngredientes((prev) => [...prev, created])
      }
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const unidadLabel = (u: string) => UNIDADES.find((x) => x.value === u)?.value ?? u

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner className="w-8 h-8 text-forest" /></div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Ingredientes</h1>
          <p className="text-sm text-stone-400 mt-0.5">Usa la misma unidad en todo: ingrediente, receta e inventario</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportarIngredientes()} className="btn-secondary flex items-center gap-1.5 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5 0-4.5 4.5M12 3v13.5m4.5-4.5L12 16.5" />
            </svg>
            Exportar CSV
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Importar CSV
          </button>
          <button onClick={openNuevaSubreceta} className="btn-secondary flex items-center gap-2">
            <span className="text-lg leading-none">+</span> Nueva sub-receta
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <span className="text-lg leading-none">+</span> Nuevo ingrediente
          </button>
        </div>
      </div>

      {importResult && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
          <p className="text-sm text-emerald-800">
            Importación completada — <strong>{importResult.creados}</strong> creados,{' '}
            <strong>{importResult.actualizados}</strong> actualizados,{' '}
            <strong>{importResult.preciosAgregados}</strong> precios registrados
          </p>
          <button onClick={() => setImportResult(null)} className="text-emerald-600 hover:text-emerald-800 text-lg leading-none ml-4">×</button>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {/* Búsqueda */}
      <div className="relative max-w-xs mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
        <input
          className="input pl-9 text-sm py-2"
          placeholder="Buscar ingrediente…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {stockBajos.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-5">
          <p className="text-sm font-medium text-amber-800 mb-2">
            ⚠ {stockBajos.length} ingrediente{stockBajos.length > 1 ? 's' : ''} con stock bajo
          </p>
          <div className="flex flex-wrap gap-2">
            {stockBajos.map((i) => (
              <span key={i.id} className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-md">
                {i.nombre} — {i.stockActual} {i.unidad}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left">
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Nombre</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Unidad</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Proveedor</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock actual</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock mín.</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Costo unitario</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {ingredientes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-stone-400">
                  Sin ingredientes registrados
                </td>
              </tr>
            )}
            {ingredientes.length > 0 && ingredientesFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-stone-400">
                  Sin resultados para "{busqueda}"
                </td>
              </tr>
            )}
            {ingredientesFiltrados.map((ing) => {
              const bajo = ing.stockActual <= ing.stockMinimo
              return (
                <tr key={ing.id} className={`hover:bg-surface-muted/50 ${bajo ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-stone-800">
                    {ing.nombre}
                    {bajo && <span className="ml-2 text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">bajo</span>}
                    {ing.rendimientoLote != null && <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">elaborado</span>}
                    {ing.marca && <span className="ml-1 text-xs text-stone-400">{ing.marca}</span>}
                  </td>
                  <td className="px-5 py-3 text-stone-500">{unidadLabel(ing.unidad)}</td>
                  <td className="px-5 py-3 text-stone-400 text-xs">{ing.proveedor || '—'}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${bajo ? 'text-amber-600' : 'text-stone-700'}`}>
                    {ing.stockActual} {ing.unidad}
                  </td>
                  <td className="px-5 py-3 text-right text-stone-400">{ing.stockMinimo} {ing.unidad}</td>
                  <td className="px-5 py-3 text-right text-stone-500">{fmt(ing.costoUnitario)}/{ing.unidad}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => setPreciosIng(ing)} className="text-xs text-forest hover:underline">Precios</button>
                      {ing.rendimientoLote != null && (
                        <button onClick={() => openSubreceta(ing)} className="text-xs text-blue-600 hover:underline">Sub-receta</button>
                      )}
                      <button onClick={() => openEdit(ing)} className="text-xs text-forest hover:underline">Editar</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal
          title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'}
          onClose={() => setShowForm(false)}
        >
          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
            )}

            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Leche entera, Café espresso, Crema…"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Unidad de medida</label>
              <select
                className="input"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
              >
                {UNIDADES.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
              <p className="text-xs text-stone-400 mt-1">
                Usa la misma unidad en la receta y al registrar compras.
                1.5 oz en receta → guarda el ingrediente en oz.
              </p>
            </div>

            {/* Stock inicial solo al crear */}
            {!editing && (
              <div>
                <label className="label">
                  Stock inicial{' '}
                  <span className="text-stone-400 font-normal">({form.unidad || '—'})</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.stockInicial}
                  onChange={(e) => setForm({ ...form, stockInicial: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-stone-400 mt-1">
                  Cantidad que tienes ahora. Puedes dejarlo en 0 y ajustar después.
                </p>
              </div>
            )}

            {/* Stock actual editable solo al editar */}
            {editing && (
              <div>
                <label className="label">
                  Stock actual{' '}
                  <span className="text-stone-400 font-normal">({form.unidad || '—'})</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.stockActual}
                  onChange={(e) => setForm({ ...form, stockActual: e.target.value })}
                />
                <p className="text-xs text-stone-400 mt-1">
                  Si cambias este valor se registrará un ajuste de inventario automáticamente.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">
                  Stock mínimo{' '}
                  <span className="text-stone-400 font-normal">({form.unidad || '—'})</span>
                </label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.001"
                  value={form.stockMinimo}
                  onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                  placeholder="0"
                />
                <p className="text-xs text-stone-400 mt-1">Alerta de stock bajo</p>
              </div>
              <div>
                <label className="label">
                  Costo por {form.unidad || '—'} (MXN)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                  <input
                    className="input pl-6"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.costoUnitario}
                    onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {!editing && form.unidad && form.costoUnitario && parseFloat(form.costoUnitario) > 0 && (
              <div className="bg-surface-muted rounded-xl px-4 py-3 text-xs text-stone-500 space-y-0.5">
                <p className="font-medium text-stone-600">Referencia de conversión</p>
                <p>1 kg = 1 000 g &nbsp;·&nbsp; 1 lb = 453.6 g &nbsp;·&nbsp; 1 oz = 28.35 g</p>
                <p>1 L = 1 000 ml &nbsp;·&nbsp; 1 fl oz = 29.57 ml</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex justify-center gap-2">
                {saving && <Spinner className="w-4 h-4 text-cream" />}
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal sub-receta */}
      {showSubreceta && (
        <Modal
          title={subrecetaIng ? `Sub-receta — ${subrecetaIng.nombre}` : 'Nueva sub-receta'}
          onClose={() => setShowSubreceta(false)}
        >
          {subrecetaLoading ? (
            <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-forest" /></div>
          ) : (
            <div className="space-y-5">
              {subrecetaError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{subrecetaError}</p>
              )}

              {/* Selector de ingrediente (siempre visible para poder cambiar) */}
              <div>
                <label className="label">Ingrediente elaborado</label>
                <select
                  className="input"
                  value={subrecetaIngId}
                  onChange={(e) => handleSeleccionarIngSubreceta(e.target.value)}
                  disabled={subrecetaSaving}
                >
                  <option value="">Seleccionar ingrediente…</option>
                  {ingredientes.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad}){i.rendimientoLote != null ? ' · ya tiene sub-receta' : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-stone-400 mt-1">Ingrediente que se produce con esta sub-receta.</p>
              </div>

              {subrecetaIng && (
                <>
                  <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1">
                    <p className="font-medium text-blue-800">¿Cómo funciona?</p>
                    <p>Define los ingredientes base y cuánto produce un lote. Al registrar una producción en Inventario, el sistema descuenta los bases y suma al stock de <strong>{subrecetaIng.nombre}</strong>.</p>
                  </div>

                  <div>
                    <label className="label">
                      Rendimiento por lote <span className="text-stone-400 font-normal">({subrecetaIng.unidad})</span>
                    </label>
                    <input
                      className="input"
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="Ej. 800"
                      value={srRendimiento}
                      onChange={(e) => setSrRendimiento(e.target.value)}
                    />
                    <p className="text-xs text-stone-400 mt-1">Cantidad de <strong>{subrecetaIng.nombre}</strong> que produces al hacer un lote.</p>
                  </div>

                  <div>
                    <label className="label">Ingredientes base</label>
                    <div className="space-y-2">
                      {srLineas.map((linea, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <select
                            className="input flex-1"
                            value={linea.baseId}
                            onChange={(e) => setSrLineas(prev => prev.map((l, idx) => idx === i ? { ...l, baseId: e.target.value } : l))}
                          >
                            <option value="">Seleccionar ingrediente…</option>
                            {ingredientes
                              .filter(i2 => i2.id !== subrecetaIng.id)
                              .map(i2 => (
                                <option key={i2.id} value={i2.id}>{i2.nombre} ({i2.unidad})</option>
                              ))}
                          </select>
                          <input
                            className="input w-24"
                            type="number" min="0.001" step="0.001"
                            placeholder="Cantidad"
                            value={linea.cantidad}
                            onChange={(e) => setSrLineas(prev => prev.map((l, idx) => idx === i ? { ...l, cantidad: e.target.value } : l))}
                          />
                          <input
                            className="input w-20"
                            type="number" min="0" max="100" step="0.5"
                            placeholder="Merma %"
                            title="% de merma"
                            value={linea.merma}
                            onChange={(e) => setSrLineas(prev => prev.map((l, idx) => idx === i ? { ...l, merma: e.target.value } : l))}
                          />
                          {srLineas.length > 1 && (
                            <button
                              onClick={() => setSrLineas(prev => prev.filter((_, idx) => idx !== i))}
                              className="text-red-400 hover:text-red-600 text-lg leading-none pb-0.5"
                            >×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setSrLineas(prev => [...prev, { baseId: '', cantidad: '', merma: '' }])}
                      className="mt-2 text-xs text-forest hover:underline flex items-center gap-1"
                    >
                      <span className="text-base leading-none">+</span> Agregar ingrediente
                    </button>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                {subreceta?.rendimientoLote != null && (
                  <button
                    onClick={handleEliminarSubreceta}
                    disabled={subrecetaSaving}
                    className="btn-secondary text-red-500 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                )}
                <button onClick={() => setShowSubreceta(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleGuardarSubreceta} disabled={subrecetaSaving || !subrecetaIng} className="btn-primary flex-1 flex justify-center gap-2">
                  {subrecetaSaving && <Spinner className="w-4 h-4 text-cream" />}
                  {subrecetaSaving ? 'Guardando…' : 'Guardar sub-receta'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {showImport && (
        <ImportarIngredientesModal
          onClose={() => setShowImport(false)}
          onSuccess={(result) => {
            setShowImport(false)
            setImportResult(result)
            cargar()
          }}
        />
      )}

      {preciosIng && (
        <PreciosIngredienteModal
          ingrediente={preciosIng}
          onClose={() => setPreciosIng(null)}
          onUpdated={() => cargar()}
        />
      )}
    </div>
  )
}
