import { useState, useEffect, useCallback } from 'react'
import {
  listarModificadores,
  crearModificador,
  actualizarModificador,
  eliminarModificador,
} from '../api/modificadores'
import { listarIngredientes } from '../api/ingredientes'
import type {
  ModificadorGrupo,
  OpcionRequest,
  Ingrediente,
} from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const describeSeleccion = (g: ModificadorGrupo) => {
  if (g.seleccionMin === 0 && g.seleccionMax === 1) return 'Opcional · máx. 1'
  if (g.seleccionMax === null) return g.seleccionMin > 0 ? `Mín. ${g.seleccionMin} · sin máx.` : 'Opcional · sin máx.'
  if (g.seleccionMin === g.seleccionMax) return `Exactamente ${g.seleccionMin}`
  if (g.seleccionMin > 0) return `Elige ${g.seleccionMin}–${g.seleccionMax}`
  return `Opcional · máx. ${g.seleccionMax}`
}

// Filas como strings para que inputs vacios no truenen; convertimos al guardar.
interface OpcionRow {
  nombre: string
  precioExtra: string
  ingredienteId: string // '' = sin descuento
  cantidad: string
}

const emptyRow = (): OpcionRow => ({ nombre: '', precioExtra: '0', ingredienteId: '', cantidad: '' })

interface GrupoForm {
  nombre: string
  seleccionMin: string
  seleccionMax: string
  opciones: OpcionRow[]
}

const emptyForm = (): GrupoForm => ({
  nombre: '',
  seleccionMin: '0',
  seleccionMax: '1',
  opciones: [emptyRow()],
})

export default function ModificadoresPage() {
  const [grupos, setGrupos] = useState<ModificadorGrupo[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ModificadorGrupo | null>(null)
  const [form, setForm] = useState<GrupoForm>(emptyForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [g, i] = await Promise.all([listarModificadores(), listarIngredientes()])
      setGrupos(g)
      setIngredientes(i)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (g: ModificadorGrupo) => {
    setEditing(g)
    const rows = (g.opciones ?? []).map((op) => ({
      nombre: op.nombre,
      precioExtra: String(op.precioExtra),
      ingredienteId: op.ingrediente ? String(op.ingrediente.id) : '',
      cantidad: op.cantidad !== null ? String(op.cantidad) : '',
    }))
    setForm({
      nombre: g.nombre,
      seleccionMin: String(g.seleccionMin),
      seleccionMax: g.seleccionMax === null ? '' : String(g.seleccionMax),
      opciones: rows.length > 0 ? rows : [emptyRow()],
    })
    setFormError('')
    setShowForm(true)
  }

  const addOpcionRow = () =>
    setForm((prev) => ({ ...prev, opciones: [...prev.opciones, emptyRow()] }))

  const updateOpcionRow = (idx: number, patch: Partial<OpcionRow>) => {
    setForm((prev) => ({
      ...prev,
      opciones: prev.opciones.map((row, i) => (i === idx ? { ...row, ...patch } : row)),
    }))
  }

  const removeOpcionRow = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      opciones: prev.opciones.filter((_, i) => i !== idx),
    }))
  }

  const handleSave = async () => {
    const nombre = form.nombre.trim()
    if (!nombre) { setFormError('El nombre del modificador es requerido'); return }

    const min = parseInt(form.seleccionMin) || 0
    const maxRaw = form.seleccionMax.trim()
    const max = maxRaw === '' ? null : parseInt(maxRaw)
    if (max !== null && (isNaN(max) || max < 1)) {
      setFormError('El máximo debe ser ≥ 1, o vacío para sin límite')
      return
    }
    if (max !== null && min > max) {
      setFormError('El mínimo no puede ser mayor que el máximo')
      return
    }

    const filas = form.opciones.filter((r) => r.nombre.trim())
    if (filas.length === 0) {
      setFormError('Agrega al menos una opción')
      return
    }

    const opciones: OpcionRequest[] = []
    for (const row of filas) {
      const precio = parseFloat(row.precioExtra) || 0
      if (precio < 0) {
        setFormError(`Precio no puede ser negativo (${row.nombre})`)
        return
      }
      const ingId = row.ingredienteId === '' ? null : parseInt(row.ingredienteId)
      let cant: number | null = null
      if (ingId !== null) {
        cant = parseFloat(row.cantidad)
        if (isNaN(cant) || cant <= 0) {
          setFormError(`La opción "${row.nombre}" tiene ingrediente: pon una cantidad > 0`)
          return
        }
      }
      opciones.push({
        nombre: row.nombre.trim(),
        precioExtra: precio,
        ingredienteId: ingId,
        cantidad: cant,
      })
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = { nombre, seleccionMin: min, seleccionMax: max, opciones }
      if (editing) {
        const updated = await actualizarModificador(editing.id, payload)
        setGrupos((prev) => prev.map((g) => (g.id === editing.id ? updated : g)))
      } else {
        const created = await crearModificador(payload)
        setGrupos((prev) => [...prev, created])
      }
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (g: ModificadorGrupo) => {
    if (!confirm(`¿Eliminar el modificador "${g.nombre}" y todas sus opciones?`)) return
    try {
      await eliminarModificador(g.id)
      setGrupos((prev) => prev.filter((x) => x.id !== g.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
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
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Modificadores</h1>
          <p className="text-sm text-stone-400 mt-0.5">Grupos de opciones que se pueden asignar a productos</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nuevo modificador
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      {grupos.length === 0 ? (
        <div className="card px-6 py-16 text-center text-stone-400 text-sm">
          Sin modificadores. Crea uno para comenzar.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Nombre</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Selección</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Opciones</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {grupos.map((g) => (
                <tr key={g.id} className="hover:bg-surface-muted/50">
                  <td className="px-5 py-3 font-medium text-stone-800">{g.nombre}</td>
                  <td className="px-5 py-3 text-stone-500">{describeSeleccion(g)}</td>
                  <td className="px-5 py-3 text-stone-500">
                    {(g.opciones ?? []).length === 0
                      ? <span className="text-stone-400 italic">sin opciones</span>
                      : (g.opciones ?? []).map((o) => o.nombre).join(', ')}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => openEdit(g)} className="text-xs text-forest hover:underline">
                        Editar
                      </button>
                      <button onClick={() => handleEliminar(g)} className="text-xs text-red-400 hover:text-red-600">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Editar modificador' : 'Nuevo modificador'}
          onClose={() => setShowForm(false)}
          size="lg"
        >
          <div className="space-y-5">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
            )}

            <div>
              <label className="label">Nombre del modificador</label>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Toppings, Tipo de leche, Tamaño…"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Mín. selección</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={form.seleccionMin}
                  onChange={(e) => setForm({ ...form, seleccionMin: e.target.value })}
                />
                <p className="text-xs text-stone-400 mt-1">0 = opcional</p>
              </div>
              <div>
                <label className="label">Máx. selección</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  value={form.seleccionMax}
                  onChange={(e) => setForm({ ...form, seleccionMax: e.target.value })}
                  placeholder="vacío = sin límite"
                />
                <p className="text-xs text-stone-400 mt-1">vacío = sin límite</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-stone-700">Opciones</p>
                <button
                  onClick={addOpcionRow}
                  type="button"
                  className="text-xs text-forest hover:underline flex items-center gap-1"
                >
                  + Añadir opción
                </button>
              </div>
              {/* Column headers */}
              <div className="flex items-center gap-2 px-1 mb-1">
                <span className="text-xs text-stone-400 flex-1">Nombre de la opción</span>
                <span className="text-xs text-stone-400 w-24 text-center">Cargo extra</span>
                <span className="w-8" />
              </div>

              <div className="space-y-2">
                {form.opciones.map((row, idx) => {
                  const selectedIng = row.ingredienteId
                    ? ingredientes.find((i) => i.id === parseInt(row.ingredienteId))
                    : null
                  return (
                    <div key={idx} className="bg-surface-muted rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          className="input flex-1 py-1.5 text-sm"
                          placeholder="Ej. Crema batida, Sin azúcar…"
                          value={row.nombre}
                          onChange={(e) => updateOpcionRow(idx, { nombre: e.target.value })}
                        />
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                          <input
                            className="input w-full py-1.5 text-sm pl-5"
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="0.00"
                            value={row.precioExtra}
                            onChange={(e) => updateOpcionRow(idx, { precioExtra: e.target.value })}
                          />
                        </div>
                        <button
                          onClick={() => removeOpcionRow(idx)}
                          type="button"
                          className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-red-600 transition-colors"
                          title="Eliminar opción"
                        >
                          ×
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pl-1">
                        <span className="text-xs text-stone-400 whitespace-nowrap" title="Si esta opción usa un ingrediente del inventario, selecciónalo aquí para que se descuente automáticamente al vender.">
                          Descuenta del inventario:
                        </span>
                        <select
                          className="input flex-1 py-1 text-xs"
                          value={row.ingredienteId}
                          onChange={(e) => updateOpcionRow(idx, {
                            ingredienteId: e.target.value,
                            cantidad: e.target.value === '' ? '' : row.cantidad,
                          })}
                        >
                          <option value="">— Sin descuento de inventario —</option>
                          {ingredientes.map((i) => (
                            <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                          ))}
                        </select>
                        <input
                          className="input w-20 py-1 text-xs disabled:bg-stone-100 disabled:text-stone-300"
                          type="number"
                          min="0"
                          step="0.1"
                          placeholder="cant."
                          value={row.cantidad}
                          disabled={!row.ingredienteId}
                          onChange={(e) => updateOpcionRow(idx, { cantidad: e.target.value })}
                        />
                        <span className="text-xs text-stone-400 w-10">
                          {selectedIng?.unidad ?? ''}
                        </span>
                      </div>
                    </div>
                  )
                })}
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
