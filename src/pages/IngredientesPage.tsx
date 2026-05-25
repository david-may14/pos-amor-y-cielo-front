import { useState, useEffect, useCallback } from 'react'
import { listarIngredientes, crearIngrediente, actualizarIngrediente } from '../api/ingredientes'
import type { Ingrediente } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

interface IngredienteForm {
  nombre: string
  unidad: string
  stockMinimo: string
  costoUnitario: string
}

const emptyForm: IngredienteForm = { nombre: '', unidad: '', stockMinimo: '', costoUnitario: '' }

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export default function IngredientesPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Ingrediente | null>(null)
  const [form, setForm] = useState<IngredienteForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

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

  const stockBajos = ingredientes.filter((i) => i.stockActual <= i.stockMinimo)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (ing: Ingrediente) => {
    setEditing(ing)
    setForm({
      nombre: ing.nombre,
      unidad: ing.unidad,
      stockMinimo: String(ing.stockMinimo),
      costoUnitario: String(ing.costoUnitario),
    })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.nombre || !form.unidad || !form.stockMinimo || !form.costoUnitario) {
      setFormError('Todos los campos son requeridos')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const data = {
        nombre: form.nombre,
        unidad: form.unidad,
        stockMinimo: parseFloat(form.stockMinimo),
        costoUnitario: parseFloat(form.costoUnitario),
      }
      if (editing) {
        const updated = await actualizarIngrediente(editing.id, data)
        setIngredientes((prev) => prev.map((i) => i.id === editing.id ? updated : i))
      } else {
        const created = await crearIngrediente(data)
        setIngredientes((prev) => [...prev, created])
      }
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-forest" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-800">Ingredientes</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nuevo ingrediente
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      {/* Stock bajo alert */}
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
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock actual</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock mín.</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Costo unitario</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {ingredientes.map((ing) => {
              const bajo = ing.stockActual <= ing.stockMinimo
              return (
                <tr key={ing.id} className={`hover:bg-surface-muted/50 ${bajo ? 'bg-amber-50/50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-stone-800">
                    {ing.nombre}
                    {bajo && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded">bajo</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-stone-500">{ing.unidad}</td>
                  <td className={`px-5 py-3 text-right font-semibold ${bajo ? 'text-amber-600' : 'text-stone-700'}`}>
                    {ing.stockActual}
                  </td>
                  <td className="px-5 py-3 text-right text-stone-400">{ing.stockMinimo}</td>
                  <td className="px-5 py-3 text-right text-stone-500">{fmt(ing.costoUnitario)}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(ing)} className="text-xs text-forest hover:underline">
                      Editar
                    </button>
                  </td>
                </tr>
              )
            })}
            {ingredientes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-stone-400">
                  Sin ingredientes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar ingrediente' : 'Nuevo ingrediente'} onClose={() => setShowForm(false)}>
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
                placeholder="Ej. Leche entera"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Unidad</label>
              <input
                className="input"
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                placeholder="Ej. L, kg, pz"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Stock mínimo</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.stockMinimo}
                  onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="label">Costo unitario (MXN)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costoUnitario}
                  onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
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
    </div>
  )
}
