import { useState, useEffect, useCallback } from 'react'
import { listarIngredientes, obtenerSubreceta, guardarSubreceta, eliminarSubreceta } from '../api/ingredientes'
import type { Ingrediente, SubrecetaDTO } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

export default function SubrecetasPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [subrecetaIng, setSubrecetaIng] = useState<Ingrediente | null>(null)
  const [subrecetaIngId, setSubrecetaIngId] = useState('')
  const [subreceta, setSubreceta] = useState<SubrecetaDTO | null>(null)
  const [subrecetaLoading, setSubrecetaLoading] = useState(false)
  const [subrecetaError, setSubrecetaError] = useState('')
  const [subrecetaSaving, setSubrecetaSaving] = useState(false)
  const [srRendimiento, setSrRendimiento] = useState('')
  const [srLineas, setSrLineas] = useState<{ baseId: string; cantidad: string }[]>([{ baseId: '', cantidad: '' }])

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

  const elaborados = ingredientes.filter((i) => i.rendimientoLote != null)

  const resetModal = () => {
    setSubrecetaIng(null)
    setSubrecetaIngId('')
    setSubreceta(null)
    setSubrecetaError('')
    setSrRendimiento('')
    setSrLineas([{ baseId: '', cantidad: '' }])
  }

  const openNueva = () => {
    resetModal()
    setShowModal(true)
  }

  const openEditar = async (ing: Ingrediente) => {
    setSubrecetaIng(ing)
    setSubrecetaIngId(String(ing.id))
    setSubrecetaError('')
    setSubrecetaLoading(true)
    setShowModal(true)
    try {
      const data = await obtenerSubreceta(ing.id)
      setSubreceta(data)
      setSrRendimiento(data.rendimientoLote != null ? String(data.rendimientoLote) : '')
      setSrLineas(data.lineas.length > 0
        ? data.lineas.map((l) => ({ baseId: String(l.baseId), cantidad: String(l.cantidad) }))
        : [{ baseId: '', cantidad: '' }])
    } catch (e: unknown) {
      setSubrecetaError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setSubrecetaLoading(false)
    }
  }

  const handleSeleccionarIng = async (id: string) => {
    setSubrecetaIngId(id)
    if (!id) { resetModal(); return }
    const ing = ingredientes.find((i) => i.id === parseInt(id))
    if (!ing) return
    setSubrecetaIng(ing)
    setSubrecetaLoading(true)
    setSubrecetaError('')
    try {
      const data = await obtenerSubreceta(ing.id)
      setSubreceta(data)
      setSrRendimiento(data.rendimientoLote != null ? String(data.rendimientoLote) : '')
      setSrLineas(data.lineas.length > 0
        ? data.lineas.map((l) => ({ baseId: String(l.baseId), cantidad: String(l.cantidad) }))
        : [{ baseId: '', cantidad: '' }])
    } catch {
      setSubreceta(null)
      setSrRendimiento('')
      setSrLineas([{ baseId: '', cantidad: '' }])
    } finally {
      setSubrecetaLoading(false)
    }
  }

  const handleGuardar = async () => {
    if (!subrecetaIng) { setSubrecetaError('Selecciona un ingrediente'); return }
    const rendimiento = parseFloat(srRendimiento)
    if (isNaN(rendimiento) || rendimiento <= 0) { setSubrecetaError('El rendimiento por lote debe ser mayor a 0'); return }
    const lineasValidas = srLineas.filter((l) => l.baseId && l.cantidad)
    if (lineasValidas.length === 0) { setSubrecetaError('Agrega al menos un ingrediente base'); return }
    setSubrecetaSaving(true)
    setSubrecetaError('')
    try {
      await guardarSubreceta(subrecetaIng.id, {
        rendimientoLote: rendimiento,
        lineas: lineasValidas.map((l) => ({ baseId: parseInt(l.baseId), cantidad: parseFloat(l.cantidad) })),
      })
      setIngredientes((prev) =>
        prev.map((i) => i.id === subrecetaIng.id ? { ...i, rendimientoLote: rendimiento } : i)
      )
      setShowModal(false)
    } catch (e: unknown) {
      setSubrecetaError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubrecetaSaving(false)
    }
  }

  const handleEliminar = async () => {
    if (!subrecetaIng) return
    setSubrecetaSaving(true)
    try {
      await eliminarSubreceta(subrecetaIng.id)
      setIngredientes((prev) =>
        prev.map((i) => i.id === subrecetaIng.id ? { ...i, rendimientoLote: null } : i)
      )
      setShowModal(false)
    } catch (e: unknown) {
      setSubrecetaError(e instanceof Error ? e.message : 'Error al eliminar')
    } finally {
      setSubrecetaSaving(false)
    }
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner className="w-8 h-8 text-forest" /></div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Sub-recetas</h1>
          <p className="text-sm text-stone-400 mt-0.5">Ingredientes elaborados a partir de otros — Cold Brew, cremas, jarabes</p>
        </div>
        <button onClick={openNueva} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nueva sub-receta
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 mb-5 text-sm text-blue-700">
        Al vender un producto que usa un ingrediente elaborado, el sistema descuenta automáticamente los ingredientes base en proporción al rendimiento del lote.
      </div>

      {elaborados.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-12 h-12 text-stone-200 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714a2.25 2.25 0 0 0 .659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 1-6.23-.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21a48.309 48.309 0 0 1-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
          </svg>
          <p className="text-stone-400 text-sm">Sin sub-recetas todavía</p>
          <p className="text-stone-300 text-xs mt-1">Crea una para ingredientes como Cold Brew, crema batida o jarabes</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Elaborado</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Unidad</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Rendimiento / lote</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {elaborados.map((ing) => (
                <tr key={ing.id} className="hover:bg-surface-muted/50">
                  <td className="px-5 py-3 font-medium text-stone-800">{ing.nombre}</td>
                  <td className="px-5 py-3 text-stone-500">{ing.unidad}</td>
                  <td className="px-5 py-3 text-right text-stone-700">
                    {ing.rendimientoLote} {ing.unidad}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => openEditar(ing)}
                      className="text-xs text-forest hover:underline"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal
          title={subrecetaIng ? `Sub-receta — ${subrecetaIng.nombre}` : 'Nueva sub-receta'}
          onClose={() => setShowModal(false)}
        >
          {subrecetaLoading ? (
            <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-forest" /></div>
          ) : (
            <div className="space-y-5">
              {subrecetaError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{subrecetaError}</p>
              )}

              <div>
                <label className="label">Ingrediente elaborado</label>
                <select
                  className="input"
                  value={subrecetaIngId}
                  onChange={(e) => handleSeleccionarIng(e.target.value)}
                  disabled={subrecetaSaving}
                >
                  <option value="">Seleccionar ingrediente…</option>
                  {ingredientes.map((i) => (
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
                    <p>Define los ingredientes base y cuánto produce un lote. Al vender un producto que usa <strong>{subrecetaIng.nombre}</strong>, el sistema descuenta los bases de forma proporcional.</p>
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
                    <p className="text-xs text-stone-400 mt-1">
                      Cantidad de <strong>{subrecetaIng.nombre}</strong> que produces al hacer un lote completo.
                    </p>
                  </div>

                  <div>
                    <label className="label">Ingredientes base</label>
                    <div className="space-y-2">
                      {srLineas.map((linea, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <select
                            className="input flex-1"
                            value={linea.baseId}
                            onChange={(e) => setSrLineas((prev) => prev.map((l, idx) => idx === i ? { ...l, baseId: e.target.value } : l))}
                          >
                            <option value="">Seleccionar ingrediente…</option>
                            {ingredientes
                              .filter((i2) => i2.id !== subrecetaIng.id)
                              .map((i2) => (
                                <option key={i2.id} value={i2.id}>{i2.nombre} ({i2.unidad})</option>
                              ))}
                          </select>
                          <input
                            className="input w-28"
                            type="number"
                            min="0.001"
                            step="0.001"
                            placeholder="Cantidad"
                            value={linea.cantidad}
                            onChange={(e) => setSrLineas((prev) => prev.map((l, idx) => idx === i ? { ...l, cantidad: e.target.value } : l))}
                          />
                          {srLineas.length > 1 && (
                            <button
                              onClick={() => setSrLineas((prev) => prev.filter((_, idx) => idx !== i))}
                              className="text-red-400 hover:text-red-600 text-lg leading-none"
                            >×</button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setSrLineas((prev) => [...prev, { baseId: '', cantidad: '' }])}
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
                    onClick={handleEliminar}
                    disabled={subrecetaSaving}
                    className="btn-secondary text-red-500 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                )}
                <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancelar</button>
                <button
                  onClick={handleGuardar}
                  disabled={subrecetaSaving || !subrecetaIng}
                  className="btn-primary flex-1 flex justify-center gap-2"
                >
                  {subrecetaSaving && <Spinner className="w-4 h-4 text-cream" />}
                  {subrecetaSaving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
