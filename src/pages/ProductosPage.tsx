import { useState, useEffect, useCallback } from 'react'
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  obtenerReceta,
  reemplazarReceta,
} from '../api/productos'
import { listarCategorias } from '../api/categorias'
import { listarIngredientes } from '../api/ingredientes'
import type { ProductoDTO, Categoria, RecetaLineaDTO, Ingrediente } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

interface ProductoForm {
  nombre: string
  precioVenta: string
  categoriaId: string
}

const emptyForm: ProductoForm = { nombre: '', precioVenta: '', categoriaId: '' }

export default function ProductosPage() {
  const [productos, setProductos] = useState<ProductoDTO[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ProductoDTO | null>(null)
  const [form, setForm] = useState<ProductoForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [recetaProducto, setRecetaProducto] = useState<ProductoDTO | null>(null)
  const [receta, setReceta] = useState<RecetaLineaDTO[]>([])
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [recetaLoading, setRecetaLoading] = useState(false)
  const [newRecetaLinea, setNewRecetaLinea] = useState({ ingredienteId: '', cantidad: '' })

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats] = await Promise.all([listarProductos(), listarCategorias()])
      setProductos(prods)
      setCategorias(cats)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (p: ProductoDTO) => {
    setEditing(p)
    const cat = categorias.find((c) => c.nombre === p.categoria)
    setForm({ nombre: p.nombre, precioVenta: String(p.precioVenta), categoriaId: cat ? String(cat.id) : '' })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.nombre || !form.precioVenta) { setFormError('Nombre y precio son requeridos'); return }
    setSaving(true)
    setFormError('')
    try {
      const data = {
        nombre: form.nombre,
        precioVenta: parseFloat(form.precioVenta),
        ...(form.categoriaId ? { categoriaId: parseInt(form.categoriaId) } : {}),
      }
      if (editing) {
        const updated = await actualizarProducto(editing.id, data)
        setProductos((prev) => prev.map((p) => p.id === editing.id ? updated : p))
      } else {
        const created = await crearProducto(data)
        setProductos((prev) => [...prev, created])
      }
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (p: ProductoDTO) => {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    try {
      await eliminarProducto(p.id)
      setProductos((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  const openReceta = async (p: ProductoDTO) => {
    setRecetaProducto(p)
    setRecetaLoading(true)
    setNewRecetaLinea({ ingredienteId: '', cantidad: '' })
    try {
      const [r, ings] = await Promise.all([obtenerReceta(p.id), listarIngredientes()])
      setReceta(r)
      setIngredientes(ings)
    } finally {
      setRecetaLoading(false)
    }
  }

  const handleGuardarReceta = async () => {
    if (!recetaProducto) return
    setSaving(true)
    try {
      const lineas = receta.map((l) => ({ ingredienteId: l.ingredienteId, cantidad: l.cantidad }))
      const updated = await reemplazarReceta(recetaProducto.id, lineas)
      setReceta(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar receta')
    } finally {
      setSaving(false)
    }
  }

  const addRecetaLinea = () => {
    if (!newRecetaLinea.ingredienteId || !newRecetaLinea.cantidad) return
    const ing = ingredientes.find((i) => i.id === parseInt(newRecetaLinea.ingredienteId))
    if (!ing) return
    const linea: RecetaLineaDTO = {
      id: 0,
      ingredienteId: ing.id,
      ingredienteNombre: ing.nombre,
      unidad: ing.unidad,
      cantidad: parseFloat(newRecetaLinea.cantidad),
    }
    setReceta((prev) => [...prev.filter((l) => l.ingredienteId !== ing.id), linea])
    setNewRecetaLinea({ ingredienteId: '', cantidad: '' })
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
        <h1 className="text-xl font-semibold text-stone-800">Productos</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nuevo producto
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left">
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Nombre</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Categoría</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Precio</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {productos.map((p) => (
              <tr key={p.id} className="hover:bg-surface-muted/50">
                <td className="px-5 py-3 font-medium text-stone-800">{p.nombre}</td>
                <td className="px-5 py-3 text-stone-500">{p.categoria || '—'}</td>
                <td className="px-5 py-3 text-right font-semibold text-forest">{fmt(p.precioVenta)}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => openReceta(p)} className="text-xs text-stone-400 hover:text-forest transition-colors">
                      Receta
                    </button>
                    <button onClick={() => openEdit(p)} className="text-xs text-forest hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleEliminar(p)} className="text-xs text-red-400 hover:text-red-600">
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-stone-400">
                  Sin productos registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <Modal title={editing ? 'Editar producto' : 'Nuevo producto'} onClose={() => setShowForm(false)}>
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
                placeholder="Ej. Latte de vainilla"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Precio de venta (MXN)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="0.5"
                value={form.precioVenta}
                onChange={(e) => setForm({ ...form, precioVenta: e.target.value })}
                placeholder="85.00"
              />
            </div>
            <div>
              <label className="label">Categoría (opcional)</label>
              <select
                className="input"
                value={form.categoriaId}
                onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
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

      {/* Receta modal */}
      {recetaProducto && (
        <Modal title={`Receta — ${recetaProducto.nombre}`} onClose={() => setRecetaProducto(null)} size="lg">
          {recetaLoading ? (
            <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-forest" /></div>
          ) : (
            <div className="space-y-4">
              {/* Current recipe */}
              {receta.length > 0 ? (
                <div className="space-y-2">
                  {receta.map((l) => (
                    <div key={l.ingredienteId} className="flex items-center justify-between bg-surface-muted rounded-lg px-4 py-2.5">
                      <span className="text-sm text-stone-700">{l.ingredienteNombre}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-stone-500">{l.cantidad} {l.unidad}</span>
                        <button
                          onClick={() => setReceta((prev) => prev.filter((x) => x.ingredienteId !== l.ingredienteId))}
                          className="text-red-400 hover:text-red-600 text-sm"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400 text-center py-4">Sin ingredientes en la receta</p>
              )}

              {/* Add line */}
              <div className="border-t border-stone-100 pt-4">
                <p className="text-xs font-medium text-stone-500 mb-2">Agregar ingrediente</p>
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={newRecetaLinea.ingredienteId}
                    onChange={(e) => setNewRecetaLinea({ ...newRecetaLinea, ingredienteId: e.target.value })}
                  >
                    <option value="">Seleccionar…</option>
                    {ingredientes.map((i) => (
                      <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                    ))}
                  </select>
                  <input
                    className="input w-24"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Cantidad"
                    value={newRecetaLinea.cantidad}
                    onChange={(e) => setNewRecetaLinea({ ...newRecetaLinea, cantidad: e.target.value })}
                  />
                  <button onClick={addRecetaLinea} className="btn-secondary px-3">+</button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setRecetaProducto(null)} className="btn-secondary flex-1">Cerrar</button>
                <button onClick={handleGuardarReceta} disabled={saving} className="btn-primary flex-1 flex justify-center gap-2">
                  {saving && <Spinner className="w-4 h-4 text-cream" />}
                  Guardar receta
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
