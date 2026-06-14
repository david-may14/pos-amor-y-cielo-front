import { useState, useEffect, useCallback } from 'react'
import {
  listarDescuentos, crearDescuento, actualizarDescuento, eliminarDescuento,
  asignarCategoria, quitarCategoria, asignarProducto, quitarProducto,
} from '../api/descuentos'
import { listarCategorias } from '../api/categorias'
import { listarProductos } from '../api/productos'
import type { DescuentoView, DescuentoRequest, Categoria, ProductoDTO } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

const fmt = (d: DescuentoView) =>
  d.tipo === 'PORCENTAJE' ? `${d.valor}%` : `$${d.valor}`

const esVencido = (fechaFin: string | null) =>
  fechaFin !== null && new Date(fechaFin) < new Date(new Date().toDateString())

interface FormState {
  nombre: string
  tipo: 'PORCENTAJE' | 'FIJO'
  valor: string
  aplicaEn: 'ITEM' | 'TICKET'
  activo: boolean
  fechaFin: string
  catIds: Set<number>
  prodIds: Set<number>
}

const emptyForm = (): FormState => ({
  nombre: '',
  tipo: 'PORCENTAJE',
  valor: '',
  aplicaEn: 'ITEM',
  activo: true,
  fechaFin: '',
  catIds: new Set(),
  prodIds: new Set(),
})

export default function DescuentosPage() {
  const [descuentos, setDescuentos] = useState<DescuentoView[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [productos, setProductos] = useState<ProductoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DescuentoView | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [desc, cats, prods] = await Promise.all([
        listarDescuentos(),
        listarCategorias(),
        listarProductos(),
      ])
      setDescuentos(desc)
      setCategorias(cats.sort((a, b) => a.orden - b.orden))
      setProductos(prods)
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

  const openEdit = (d: DescuentoView) => {
    setEditing(d)
    setForm({
      nombre: d.nombre,
      tipo: d.tipo,
      valor: String(d.valor),
      aplicaEn: d.aplicaEn,
      activo: d.activo,
      fechaFin: d.fechaFin ?? '',
      catIds: new Set(d.categorias.map((c) => c.id)),
      prodIds: new Set(d.productos.map((p) => p.id)),
    })
    setFormError('')
    setShowForm(true)
  }

  const toggleCat = (id: number) =>
    setForm((p) => {
      const next = new Set(p.catIds)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...p, catIds: next }
    })

  const toggleProd = (id: number) =>
    setForm((p) => {
      const next = new Set(p.prodIds)
      next.has(id) ? next.delete(id) : next.add(id)
      return { ...p, prodIds: next }
    })

  const handleSave = async () => {
    const nombre = form.nombre.trim()
    if (!nombre) { setFormError('El nombre es requerido'); return }
    const valor = parseFloat(form.valor)
    if (isNaN(valor) || valor <= 0) { setFormError('El valor debe ser mayor a 0'); return }
    if (form.tipo === 'PORCENTAJE' && valor > 100) { setFormError('El porcentaje no puede superar 100%'); return }

    setSaving(true)
    setFormError('')
    try {
      const req: DescuentoRequest = {
        nombre,
        tipo: form.tipo,
        valor,
        aplicaEn: form.aplicaEn,
        activo: form.activo,
        fechaFin: form.fechaFin || null,
      }

      let saved: DescuentoView
      if (editing) {
        saved = await actualizarDescuento(editing.id, req)
        // Sincronizar asignaciones de categorías
        const oldCats = new Set(editing.categorias.map((c) => c.id))
        await Promise.all([
          ...[...form.catIds].filter((id) => !oldCats.has(id)).map((id) => asignarCategoria(saved.id, id)),
          ...[...oldCats].filter((id) => !form.catIds.has(id)).map((id) => quitarCategoria(saved.id, id)),
        ])
        // Sincronizar asignaciones de productos
        const oldProds = new Set(editing.productos.map((p) => p.id))
        await Promise.all([
          ...[...form.prodIds].filter((id) => !oldProds.has(id)).map((id) => asignarProducto(saved.id, id)),
          ...[...oldProds].filter((id) => !form.prodIds.has(id)).map((id) => quitarProducto(saved.id, id)),
        ])
      } else {
        saved = await crearDescuento(req)
        await Promise.all([
          ...[...form.catIds].map((id) => asignarCategoria(saved.id, id)),
          ...[...form.prodIds].map((id) => asignarProducto(saved.id, id)),
        ])
      }
      // Recargar para obtener asignaciones actualizadas
      const updated = await listarDescuentos()
      setDescuentos(updated)
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleEliminar = async (d: DescuentoView) => {
    if (!confirm(`¿Eliminar el descuento "${d.nombre}"?`)) return
    try {
      await eliminarDescuento(d.id)
      setDescuentos((prev) => prev.filter((x) => x.id !== d.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner className="w-8 h-8 text-forest" /></div>
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Descuentos</h1>
          <p className="text-sm text-stone-400 mt-0.5">Por categoría, por producto o para el ticket completo</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nuevo descuento
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {descuentos.length === 0 ? (
        <div className="card px-6 py-16 text-center text-stone-400 text-sm">
          Sin descuentos. Crea uno para comenzar.
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Nombre</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Descuento</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Aplica a</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Asignado a</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Vence</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {descuentos.map((d) => {
                const vencido = esVencido(d.fechaFin)
                const efectivo = d.activo && !vencido
                const asignaciones = d.aplicaEn === 'TICKET'
                  ? 'Ticket completo'
                  : [
                      ...d.categorias.map((c) => c.nombre),
                      ...d.productos.map((p) => p.nombre),
                    ].join(', ') || '—'
                return (
                  <tr key={d.id} className="hover:bg-surface-muted/50">
                    <td className="px-5 py-3 font-medium text-stone-800">{d.nombre}</td>
                    <td className="px-5 py-3 text-stone-700 font-semibold">{fmt(d)}</td>
                    <td className="px-5 py-3 text-stone-500">
                      {d.aplicaEn === 'TICKET' ? 'Ticket' : 'Ítem'}
                    </td>
                    <td className="px-5 py-3 text-stone-500 max-w-xs truncate">{asignaciones}</td>
                    <td className="px-5 py-3 text-stone-500">
                      {d.fechaFin
                        ? new Date(d.fechaFin + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {vencido
                        ? <span className="text-xs bg-stone-100 text-stone-400 px-2 py-0.5 rounded-full">Vencido</span>
                        : efectivo
                        ? <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Activo</span>
                        : <span className="text-xs bg-stone-100 text-stone-400 px-2 py-0.5 rounded-full">Inactivo</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => openEdit(d)} className="text-xs text-forest hover:underline">Editar</button>
                        <button onClick={() => handleEliminar(d)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Editar descuento' : 'Nuevo descuento'}
          onClose={() => setShowForm(false)}
          size="lg"
        >
          <div className="space-y-5">
            {formError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}

            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Ej. Martes de oferta, Descuento empleados…"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select
                  className="input"
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value as 'PORCENTAJE' | 'FIJO' })}
                >
                  <option value="PORCENTAJE">Porcentaje (%)</option>
                  <option value="FIJO">Monto fijo ($)</option>
                </select>
              </div>
              <div>
                <label className="label">{form.tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto ($)'}</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                    {form.tipo === 'PORCENTAJE' ? '%' : '$'}
                  </span>
                  <input
                    className="input pl-6"
                    type="number"
                    min="0"
                    max={form.tipo === 'PORCENTAJE' ? 100 : undefined}
                    step={form.tipo === 'PORCENTAJE' ? '1' : '0.5'}
                    value={form.valor}
                    onChange={(e) => setForm({ ...form, valor: e.target.value })}
                    placeholder={form.tipo === 'PORCENTAJE' ? '10' : '20.00'}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Aplica a</label>
                <select
                  className="input"
                  value={form.aplicaEn}
                  onChange={(e) => setForm({ ...form, aplicaEn: e.target.value as 'ITEM' | 'TICKET', catIds: new Set(), prodIds: new Set() })}
                >
                  <option value="ITEM">Ítems (por producto)</option>
                  <option value="TICKET">Ticket completo</option>
                </select>
              </div>
              <div>
                <label className="label">Fecha de fin (opcional)</label>
                <input
                  className="input"
                  type="date"
                  value={form.fechaFin}
                  onChange={(e) => setForm({ ...form, fechaFin: e.target.value })}
                />
                <p className="text-xs text-stone-400 mt-1">Se desactiva automáticamente al vencer</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, activo: !form.activo })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${form.activo ? 'bg-forest' : 'bg-stone-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.activo ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
              <span className="text-sm text-stone-700">{form.activo ? 'Activo' : 'Inactivo'}</span>
            </div>

            {/* Asignaciones — solo para descuentos ITEM */}
            {form.aplicaEn === 'ITEM' && (
              <div className="space-y-4 border-t border-stone-100 pt-4">
                <div>
                  <p className="text-sm font-medium text-stone-700 mb-2">Categorías</p>
                  <p className="text-xs text-stone-400 mb-3">El descuento aplica a todos los productos de las categorías seleccionadas. Categoría tiene prioridad sobre producto.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {categorias.map((c) => (
                      <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.catIds.has(c.id)}
                          onChange={() => toggleCat(c.id)}
                          className="w-4 h-4 accent-forest"
                        />
                        <span className="text-sm text-stone-700">{c.nombre}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-stone-700 mb-2">Productos específicos</p>
                  <p className="text-xs text-stone-400 mb-3">Solo aplica si el producto no tiene un descuento de categoría activo.</p>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-stone-100 rounded-xl p-3 bg-surface-muted">
                    {productos.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.prodIds.has(p.id)}
                          onChange={() => toggleProd(p.id)}
                          className="w-4 h-4 accent-forest"
                        />
                        <span className="text-sm text-stone-700">{p.nombre}</span>
                        {p.categoria && <span className="text-xs text-stone-400">({p.categoria})</span>}
                      </label>
                    ))}
                  </div>
                </div>
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
    </div>
  )
}
