import { useState, useEffect, useCallback } from 'react'
import {
  listarPlantillas,
  crearPlantilla,
  actualizarPlantilla,
  toggleActivoPlantilla,
  eliminarPlantilla,
  reemplazarIngredientes,
  duplicarPlantilla,
} from '../api/plantillas'
import { listarIngredientes } from '../api/ingredientes'
import type { PlantillaDTO, Ingrediente } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import SearchableSelect from '../components/SearchableSelect'
import Toast from '../components/Toast'

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<PlantillaDTO[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal crear/editar nombre
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PlantillaDTO | null>(null)
  const [nombre, setNombre] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Modal ingredientes
  const [ingModal, setIngModal] = useState<PlantillaDTO | null>(null)
  const [ingLineas, setIngLineas] = useState<{ ingredienteId: number; ingredienteNombre: string; unidad: string; cantidad: number; mermaPorcentaje: number }[]>([])
  const [newLinea, setNewLinea] = useState({ ingredienteId: '', cantidad: '', merma: '' })
  const [ingSaving, setIngSaving] = useState(false)
  const [ingError, setIngError] = useState('')
  const [toastMsg, setToastMsg] = useState('')

  const [toggling, setToggling] = useState<number | null>(null)

  // Modal duplicar
  const [duplicateSource, setDuplicateSource] = useState<PlantillaDTO | null>(null)
  const [duplicateNombre, setDuplicateNombre] = useState('')
  const [duplicateSaving, setDuplicateSaving] = useState(false)
  const [duplicateError, setDuplicateError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [p, i] = await Promise.all([listarPlantillas(), listarIngredientes()])
      setPlantillas(p)
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
    setNombre('')
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (p: PlantillaDTO) => {
    setEditing(p)
    setNombre(p.nombre)
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!nombre.trim()) { setFormError('El nombre es requerido'); return }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        const updated = await actualizarPlantilla(editing.id, { nombre: nombre.trim() })
        setPlantillas((prev) => prev.map((p) => p.id === editing.id ? updated : p))
      } else {
        const created = await crearPlantilla({ nombre: nombre.trim() })
        setPlantillas((prev) => [...prev, created])
      }
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActivo = async (p: PlantillaDTO) => {
    if (toggling === p.id) return
    setToggling(p.id)
    try {
      const updated = await toggleActivoPlantilla(p.id)
      setPlantillas((prev) => prev.map((x) => x.id === p.id ? updated : x))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setToggling(null)
    }
  }

  const handleEliminar = async (p: PlantillaDTO) => {
    if (!confirm(`¿Eliminar la plantilla "${p.nombre}"? Esta acción no se puede deshacer.`)) return
    try {
      await eliminarPlantilla(p.id)
      setPlantillas((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const openIngredientes = (p: PlantillaDTO) => {
    setIngModal(p)
    setIngLineas(p.ingredientes.map((l) => ({
      ingredienteId: l.ingredienteId,
      ingredienteNombre: l.ingredienteNombre,
      unidad: l.unidad,
      cantidad: l.cantidad,
      mermaPorcentaje: l.mermaPorcentaje ?? 0,
    })))
    setNewLinea({ ingredienteId: '', cantidad: '', merma: '' })
    setIngError('')
    
  }

  const addIngLinea = () => {
    if (!newLinea.ingredienteId || !newLinea.cantidad) return
    const ing = ingredientes.find((i) => i.id === parseInt(newLinea.ingredienteId))
    if (!ing) return
    setIngLineas((prev) => [
      ...prev.filter((l) => l.ingredienteId !== ing.id),
      { ingredienteId: ing.id, ingredienteNombre: ing.nombre, unidad: ing.unidad, cantidad: parseFloat(newLinea.cantidad), mermaPorcentaje: parseFloat(newLinea.merma) || 0 },
    ])
    setNewLinea({ ingredienteId: '', cantidad: '', merma: '' })
  }

  const handleGuardarIngredientes = async () => {
    if (!ingModal) return

    // Flush pending line
    let lineasBase = ingLineas
    if (newLinea.ingredienteId && newLinea.cantidad) {
      const ing = ingredientes.find((i) => i.id === parseInt(newLinea.ingredienteId))
      if (ing) {
        lineasBase = [
          ...lineasBase.filter((l) => l.ingredienteId !== ing.id),
          { ingredienteId: ing.id, ingredienteNombre: ing.nombre, unidad: ing.unidad, cantidad: parseFloat(newLinea.cantidad), mermaPorcentaje: parseFloat(newLinea.merma) || 0 },
        ]
        setIngLineas(lineasBase)
        setNewLinea({ ingredienteId: '', cantidad: '', merma: '' })
      }
    }

    setIngSaving(true)
    setIngError('')
    
    try {
      const updated = await reemplazarIngredientes(
        ingModal.id,
        lineasBase.map((l) => ({ ingredienteId: l.ingredienteId, cantidad: l.cantidad, mermaPorcentaje: l.mermaPorcentaje ?? 0 }))
      )
      setPlantillas((prev) => prev.map((p) => p.id === ingModal.id ? updated : p))
      setIngModal(updated)
      setToastMsg("Ingredientes guardados")
    } catch (e: unknown) {
      setIngError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setIngSaving(false)
    }
  }

  const openDuplicar = (p: PlantillaDTO) => {
    setDuplicateSource(p)
    setDuplicateNombre(`Copia de ${p.nombre}`)
    setDuplicateError('')
  }

  const handleDuplicar = async () => {
    if (!duplicateSource) return
    if (!duplicateNombre.trim()) { setDuplicateError('El nombre es requerido'); return }
    setDuplicateSaving(true)
    setDuplicateError('')
    try {
      const nueva = await duplicarPlantilla(duplicateSource.id, duplicateNombre.trim())
      setPlantillas((prev) => [...prev, nueva])
      setDuplicateSource(null)
      setToastMsg(`Plantilla "${nueva.nombre}" creada`)
    } catch (e: unknown) {
      setDuplicateError(e instanceof Error ? e.message : 'Error al duplicar')
    } finally {
      setDuplicateSaving(false)
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
          <h1 className="text-xl font-semibold text-stone-800">Plantillas de receta</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Grupos de ingredientes comunes que puedes reutilizar en múltiples productos
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nueva plantilla
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      {plantillas.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-12 h-12 text-stone-200 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
          </svg>
          <p className="text-stone-400 text-sm">Sin plantillas todavía</p>
          <p className="text-stone-300 text-xs mt-1">Crea una plantilla como "Base Frappe" con vaso, tapa, hielo y leche</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Plantilla</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Ingredientes</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Activa</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {plantillas.map((p) => (
                <tr key={p.id} className={`hover:bg-surface-muted/50 ${!p.activo ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 font-medium text-stone-800">
                    {p.nombre}
                    {!p.activo && (
                      <span className="ml-2 text-xs bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded">inactiva</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-stone-500">
                    {p.ingredientes.length === 0 ? (
                      <span className="text-stone-300 italic">Sin ingredientes</span>
                    ) : (
                      <span className="text-xs">
                        {p.ingredientes.map((i) => `${i.ingredienteNombre} (${i.cantidad} ${i.unidad})`).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => handleToggleActivo(p)}
                      disabled={toggling === p.id}
                      className={`relative w-11 h-6 rounded-full transition-colors ${p.activo ? 'bg-forest' : 'bg-stone-200'}`}
                    >
                      {toggling === p.id ? (
                        <Spinner className="absolute inset-0 m-auto w-3 h-3 text-white" />
                      ) : (
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${p.activo ? 'left-5' : 'left-0.5'}`} />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <button
                        onClick={() => openIngredientes(p)}
                        className="text-xs text-stone-400 hover:text-forest transition-colors"
                      >
                        Ingredientes
                      </button>
                      <button
                        onClick={() => openDuplicar(p)}
                        className="text-xs text-stone-400 hover:text-forest transition-colors"
                        title="Duplicar plantilla"
                      >
                        Duplicar
                      </button>
                      <button
                        onClick={() => openEdit(p)}
                        className="text-xs text-forest hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleEliminar(p)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
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

      {/* Modal crear/editar nombre */}
      {showForm && (
        <Modal title={editing ? 'Editar plantilla' : 'Nueva plantilla'} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            {formError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>
            )}
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="Ej. Base Frappe, Base Latte"
                autoFocus
              />
              <p className="text-xs text-stone-400 mt-1">
                Después de crear la plantilla, agrega sus ingredientes desde la tabla.
              </p>
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

      {/* Modal ingredientes */}
      {ingModal && (
        <Modal
          title={`Ingredientes — ${ingModal.nombre}`}
          onClose={() => setIngModal(null)}
          size="lg"
        >
          <div className="space-y-4">
            {ingError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{ingError}</p>
            )}


            <p className="text-xs text-stone-400">
              Estos ingredientes se descontarán del inventario automáticamente al vender cualquier producto que use esta plantilla.
            </p>

            {ingLineas.length > 0 ? (
              <div className="space-y-2">
                {ingLineas.map((l) => (
                  <div
                    key={l.ingredienteId}
                    className="flex items-center justify-between bg-surface-muted rounded-lg px-4 py-2.5"
                  >
                    <span className="text-sm text-stone-700">{l.ingredienteNombre}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-stone-500">{l.cantidad} {l.unidad}</span>
                      {l.mermaPorcentaje > 0 && (
                        <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
                          +{l.mermaPorcentaje}% merma
                        </span>
                      )}
                      <button
                        onClick={() => setIngLineas((prev) => prev.filter((x) => x.ingredienteId !== l.ingredienteId))}
                        className="text-red-400 hover:text-red-600 text-sm leading-none"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-stone-400 text-center py-4">Sin ingredientes aún</p>
            )}

            <div className="border-t border-stone-100 pt-4 space-y-2">
              <p className="text-xs font-medium text-stone-500">Agregar ingrediente</p>
              <div className="flex gap-2">
                <SearchableSelect
                  className="flex-1"
                  options={ingredientes
                    .filter((i) => !ingLineas.some((l) => l.ingredienteId === i.id))
                    .map((i) => ({ value: String(i.id), label: `${i.nombre} (${i.unidad})` }))}
                  value={newLinea.ingredienteId}
                  onChange={(v) => setNewLinea({ ...newLinea, ingredienteId: v })}
                />
                <input
                  className="input w-24"
                  type="number" min="0" step="0.01"
                  placeholder="Cantidad"
                  value={newLinea.cantidad}
                  onChange={(e) => setNewLinea({ ...newLinea, cantidad: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && addIngLinea()}
                />
                <div className="relative">
                  <input
                    className="input w-20 pr-6"
                    type="number" min="0" max="100" step="0.5"
                    placeholder="Merma"
                    title="% de merma"
                    value={newLinea.merma}
                    onChange={(e) => setNewLinea({ ...newLinea, merma: e.target.value })}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">%</span>
                </div>
                <button onClick={addIngLinea} className="btn-secondary px-3">+</button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setIngModal(null)} className="btn-secondary flex-1">Cerrar</button>
              <button
                onClick={handleGuardarIngredientes}
                disabled={ingSaving}
                className="btn-primary flex-1 flex justify-center gap-2"
              >
                {ingSaving && <Spinner className="w-4 h-4 text-cream" />}
                Guardar ingredientes
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Modal duplicar */}
      {duplicateSource && (
        <Modal title={`Duplicar — ${duplicateSource.nombre}`} onClose={() => setDuplicateSource(null)}>
          <div className="space-y-4">
            {duplicateError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{duplicateError}</p>
            )}
            <p className="text-sm text-stone-500">
              Se creará una copia de <span className="font-medium text-stone-700">{duplicateSource.nombre}</span> con todos sus ingredientes ({duplicateSource.ingredientes.length}).
            </p>
            <div>
              <label className="label">Nombre de la nueva plantilla</label>
              <input
                className="input"
                value={duplicateNombre}
                onChange={(e) => setDuplicateNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDuplicar()}
                autoFocus
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDuplicateSource(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleDuplicar} disabled={duplicateSaving} className="btn-primary flex-1 flex justify-center gap-2">
                {duplicateSaving && <Spinner className="w-4 h-4 text-cream" />}
                {duplicateSaving ? 'Duplicando…' : 'Duplicar'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}
    </div>
  )
}
