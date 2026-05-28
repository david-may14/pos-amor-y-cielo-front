import { useState, useEffect } from 'react'
import { listarPrecios, agregarPrecio, desactivarPrecio } from '../api/ingredientes'
import type { Ingrediente, IngredientePrecioDTO } from '../types/api'
import Modal from './Modal'
import Spinner from './Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const fmtU = (n: number) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n)

interface Props {
  ingrediente: Ingrediente
  onClose: () => void
  onUpdated: (ing: Ingrediente) => void
}

export default function PreciosIngredienteModal({ ingrediente, onClose, onUpdated }: Props) {
  const [precios, setPrecios] = useState<IngredientePrecioDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ proveedor: '', precioTotal: '', cantidad: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      setPrecios(await listarPrecios(ingrediente.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar precios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  const handleAgregar = async () => {
    if (!form.precioTotal || !form.cantidad) {
      setFormError('Precio total y cantidad son requeridos')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await agregarPrecio(ingrediente.id, {
        proveedor: form.proveedor || undefined,
        precioTotal: parseFloat(form.precioTotal),
        cantidad: parseFloat(form.cantidad),
      })
      setForm({ proveedor: '', precioTotal: '', cantidad: '' })
      setShowForm(false)
      await cargar()
      // Notify parent that cost might have changed
      onUpdated({ ...ingrediente })
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al agregar precio')
    } finally {
      setSaving(false)
    }
  }

  const handleDesactivar = async (precioId: number) => {
    try {
      await desactivarPrecio(ingrediente.id, precioId)
      await cargar()
      onUpdated({ ...ingrediente })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al desactivar precio')
    }
  }

  const activos = precios.filter(p => p.activo)
  const inactivos = precios.filter(p => !p.activo)

  return (
    <Modal title={`Precios — ${ingrediente.nombre}`} onClose={onClose} size="md">
      <div className="space-y-4">
        {/* Metadata chips */}
        <div className="flex flex-wrap gap-2">
          {ingrediente.marca && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">{ingrediente.marca}</span>
          )}
          {ingrediente.proveedor && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">{ingrediente.proveedor}</span>
          )}
          {ingrediente.grupo && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">{ingrediente.grupo}</span>
          )}
          {ingrediente.presentacion && ingrediente.formatoCompra && (
            <span className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">
              {ingrediente.formatoCompra} {ingrediente.unidad} / {ingrediente.presentacion}
            </span>
          )}
        </div>

        {/* Costo actual */}
        <div className="bg-forest/5 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-stone-600">Costo unitario actual</span>
          <span className="text-lg font-semibold text-forest">{fmt(ingrediente.costoUnitario)} / {ingrediente.unidad}</span>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}

        {loading ? (
          <div className="flex justify-center py-6"><Spinner className="w-6 h-6 text-forest" /></div>
        ) : (
          <>
            {/* Precios activos */}
            {activos.length > 0 && (
              <div>
                <p className="text-xs font-medium text-stone-400 uppercase tracking-wide mb-2">Precios activos</p>
                <div className="space-y-2">
                  {activos.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-white border border-stone-100 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-stone-700">{p.proveedor || 'Sin proveedor'}</p>
                        <p className="text-xs text-stone-400">
                          {fmt(p.precioTotal)} por {p.cantidad} {ingrediente.unidad} · {p.fecha}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-forest">{fmtU(p.precioUnitario)}</p>
                        <p className="text-xs text-stone-400">/{ingrediente.unidad}</p>
                      </div>
                      <button
                        onClick={() => handleDesactivar(p.id)}
                        className="text-stone-300 hover:text-red-400 transition-colors ml-1"
                        title="Desactivar precio"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Precios históricos */}
            {inactivos.length > 0 && (
              <details className="group">
                <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600">
                  Ver {inactivos.length} precio{inactivos.length !== 1 ? 's' : ''} histórico{inactivos.length !== 1 ? 's' : ''}
                </summary>
                <div className="mt-2 space-y-1">
                  {inactivos.map(p => (
                    <div key={p.id} className="flex items-center gap-3 opacity-50 px-3 py-1.5 rounded">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-stone-500">{p.proveedor || 'Sin proveedor'} · {p.fecha}</p>
                        <p className="text-xs text-stone-400">{fmt(p.precioTotal)} / {p.cantidad} {ingrediente.unidad}</p>
                      </div>
                      <p className="text-xs text-stone-400 line-through">{fmtU(p.precioUnitario)}</p>
                    </div>
                  ))}
                </div>
              </details>
            )}

            {activos.length === 0 && inactivos.length === 0 && (
              <p className="text-sm text-stone-400 text-center py-3">Sin precios registrados</p>
            )}
          </>
        )}

        {/* Agregar precio */}
        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="btn-secondary w-full text-sm">
            + Registrar nuevo precio
          </button>
        ) : (
          <div className="border border-stone-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-stone-700">Nuevo precio</p>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div>
              <label className="label">Proveedor (opcional)</label>
              <input className="input" value={form.proveedor}
                onChange={e => setForm({ ...form, proveedor: e.target.value })}
                placeholder="Walmart, Costco…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Precio total pagado (MXN)</label>
                <input className="input" type="number" min="0" step="0.01" value={form.precioTotal}
                  onChange={e => setForm({ ...form, precioTotal: e.target.value })}
                  placeholder="44.00" />
              </div>
              <div>
                <label className="label">Cantidad ({ingrediente.unidad})</label>
                <input className="input" type="number" min="0" step="0.001" value={form.cantidad}
                  onChange={e => setForm({ ...form, cantidad: e.target.value })}
                  placeholder="19.0" />
              </div>
            </div>
            {form.precioTotal && form.cantidad && parseFloat(form.cantidad) > 0 && (
              <p className="text-xs text-stone-500">
                Costo unitario resultante: <strong>{fmtU(parseFloat(form.precioTotal) / parseFloat(form.cantidad))}</strong> / {ingrediente.unidad}
              </p>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleAgregar} disabled={saving}
                className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                {saving && <Spinner className="w-4 h-4 text-cream" />}
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
