import { useState, useEffect, useCallback } from 'react'
import {
  listarProductos,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
  obtenerReceta,
  reemplazarReceta,
  listarModificadoresProducto,
  asignarModificador,
  quitarModificador,
  toggleDisponibilidad,
  listarPlantillasProducto,
  asignarPlantillasProducto,
  exportarProductos,
} from '../api/productos'
import { listarModificadores } from '../api/modificadores'
import { listarCategorias } from '../api/categorias'
import { listarIngredientes } from '../api/ingredientes'
import { listarPlantillas } from '../api/plantillas'
import type { ProductoDTO, Categoria, RecetaLineaDTO, Ingrediente, ModificadorGrupo, PlantillaDTO, ImportResult } from '../types/api'
import SearchableSelect from '../components/SearchableSelect'
import Toast from '../components/Toast'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import ImportarProductosModal from '../components/ImportarProductosModal'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

interface ProductoForm {
  nombre: string
  precioVenta: string
  costo: string
  categoriaId: string
}

const emptyForm: ProductoForm = { nombre: '', precioVenta: '', costo: '', categoriaId: '' }

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
  const [recetaError, setRecetaError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [newRecetaLinea, setNewRecetaLinea] = useState({ ingredienteId: '', cantidad: '', merma: '' })

  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos')

  const [togglingDisp, setTogglingDisp] = useState<number | null>(null)

  const [modifProducto, setModifProducto] = useState<ProductoDTO | null>(null)
  const [todosGrupos, setTodosGrupos] = useState<ModificadorGrupo[]>([])
  const [gruposAsignados, setGruposAsignados] = useState<Set<number>>(new Set())
  const [modifLoading, setModifLoading] = useState(false)
  const [toggling, setToggling] = useState<number | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const [plantillasProducto, setPlantillasProducto] = useState<ProductoDTO | null>(null)
  const [todasPlantillas, setTodasPlantillas] = useState<PlantillaDTO[]>([])
  const [plantillasSeleccionadas, setPlantillasSeleccionadas] = useState<Set<number>>(new Set())
  const [plantillasLoading, setPlantillasLoading] = useState(false)
  const [plantillasSaving, setPlantillasSaving] = useState(false)
  const [plantillasError, setPlantillasError] = useState('')
  const [plantillasExpandidas, setPlantillasExpandidas] = useState<Set<number>>(new Set())

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
    setForm({ nombre: p.nombre, precioVenta: String(p.precioVenta), costo: String(p.costo ?? 0), categoriaId: cat ? String(cat.id) : '' })
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
        costo: parseFloat(form.costo) || 0,
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
    setRecetaError('')
    setNewRecetaLinea({ ingredienteId: '', cantidad: '', merma: '' })
    try {
      const [r, ings, todas, actuales] = await Promise.all([
        obtenerReceta(p.id),
        listarIngredientes(),
        listarPlantillas(),
        listarPlantillasProducto(p.id),
      ])
      setReceta(r)
      setIngredientes(ings)
      setTodasPlantillas(todas)
      setPlantillasSeleccionadas(new Set(actuales.map((pl) => pl.id)))
    } finally {
      setRecetaLoading(false)
    }
  }

  const handleGuardarReceta = async () => {
    if (!recetaProducto) return
    // flush pending form line before saving
    let lineasBase = receta
    if (newRecetaLinea.ingredienteId && newRecetaLinea.cantidad) {
      const ing = ingredientes.find((i) => i.id === parseInt(newRecetaLinea.ingredienteId))
      if (ing) {
        const linea: RecetaLineaDTO = {
          id: 0, ingredienteId: ing.id, ingredienteNombre: ing.nombre,
          unidad: ing.unidad, cantidad: parseFloat(newRecetaLinea.cantidad),
          mermaPorcentaje: parseFloat(newRecetaLinea.merma) || 0,
        }
        lineasBase = [...lineasBase.filter((l) => l.ingredienteId !== ing.id), linea]
        setReceta(lineasBase)
        setNewRecetaLinea({ ingredienteId: '', cantidad: '', merma: '' })
      }
    }
    setSaving(true)
    setRecetaError('')
    
    try {
      const lineas = lineasBase.map((l) => ({ ingredienteId: l.ingredienteId, cantidad: l.cantidad, mermaPorcentaje: l.mermaPorcentaje ?? 0 }))
      const [updated] = await Promise.all([
        reemplazarReceta(recetaProducto.id, lineas),
        asignarPlantillasProducto(recetaProducto.id, [...plantillasSeleccionadas]),
      ])
      setReceta(updated)
      setToastMsg("Receta guardada")
    } catch (e: unknown) {
      setRecetaError(e instanceof Error ? e.message : 'Error al guardar receta')
    } finally {
      setSaving(false)
    }
  }

  const openModificadores = async (p: ProductoDTO) => {
    setModifProducto(p)
    setModifLoading(true)
    try {
      const [todos, asignados] = await Promise.all([
        listarModificadores(),
        listarModificadoresProducto(p.id),
      ])
      setTodosGrupos(todos)
      setGruposAsignados(new Set(asignados.map((g) => g.id)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar modificadores')
    } finally {
      setModifLoading(false)
    }
  }

  const handleToggleDisponibilidad = async (p: ProductoDTO) => {
    if (togglingDisp === p.id) return
    setTogglingDisp(p.id)
    try {
      const updated = await toggleDisponibilidad(p.id)
      setProductos((prev) => prev.map((x) => x.id === p.id ? updated : x))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al actualizar disponibilidad')
    } finally {
      setTogglingDisp(null)
    }
  }

  const openPlantillas = async (p: ProductoDTO) => {
    setPlantillasProducto(p)
    setPlantillasLoading(true)
    setPlantillasError('')
    try {
      const [todas, actuales] = await Promise.all([listarPlantillas(), listarPlantillasProducto(p.id)])
      setTodasPlantillas(todas)
      setPlantillasSeleccionadas(new Set(actuales.map((pl) => pl.id)))
    } catch (e: unknown) {
      setPlantillasError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setPlantillasLoading(false)
    }
  }

  const handleGuardarPlantillas = async () => {
    if (!plantillasProducto) return
    setPlantillasSaving(true)
    setPlantillasError('')
    try {
      await asignarPlantillasProducto(plantillasProducto.id, [...plantillasSeleccionadas])
      setPlantillasProducto(null)
    } catch (e: unknown) {
      setPlantillasError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setPlantillasSaving(false)
    }
  }

  const handleToggleGrupo = async (grupoId: number, asignado: boolean) => {
    if (!modifProducto || toggling === grupoId) return
    setToggling(grupoId)
    try {
      if (asignado) {
        await quitarModificador(modifProducto.id, grupoId)
        setGruposAsignados((prev) => { const next = new Set(prev); next.delete(grupoId); return next })
      } else {
        await asignarModificador(modifProducto.id, grupoId)
        setGruposAsignados((prev) => new Set([...prev, grupoId]))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al actualizar')
    } finally {
      setToggling(null)
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
      mermaPorcentaje: parseFloat(newRecetaLinea.merma) || 0,
    }
    setReceta((prev) => [...prev.filter((l) => l.ingredienteId !== ing.id), linea])
    setNewRecetaLinea({ ingredienteId: '', cantidad: '', merma: '' })
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-forest" />
      </div>
    )
  }

  const productosFiltrados = productos
    .filter((p) => categoriaFiltro === 'Todos' || p.categoria === categoriaFiltro)
    .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-800">Productos</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportarProductos().catch((e) => setError(e.message))}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Exportar CSV
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            Importar CSV
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <span className="text-lg leading-none">+</span> Nuevo producto
          </button>
        </div>
      </div>

      {importResult && (
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
          <p className="text-sm text-emerald-800">
            Importación completada — <strong>{importResult.creados}</strong> creados,{' '}
            <strong>{importResult.actualizados}</strong> actualizados,{' '}
            <strong>{importResult.eliminados}</strong> desactivados,{' '}
            <strong>{importResult.categoriasNuevas}</strong> categorías nuevas
          </p>
          <button onClick={() => setImportResult(null)} className="text-emerald-600 hover:text-emerald-800 text-lg leading-none ml-4">×</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4 items-center">
        {/* Búsqueda */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            className="input pl-9 text-sm py-2"
            placeholder="Buscar producto…"
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

        {/* Filtro por categoría */}
        <div className="flex gap-1 flex-wrap">
          {['Todos', ...categorias.map((c) => c.nombre)].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                categoriaFiltro === cat
                  ? 'bg-forest text-cream border-forest'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-forest/50'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left">
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Nombre</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Categoría</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Precio</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Costo</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {productosFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-stone-400">
                  {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin productos en esta categoría'}
                </td>
              </tr>
            )}
            {productosFiltrados.map((p) => (
              <tr key={p.id} className={`hover:bg-surface-muted/50 ${!p.disponible ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3 font-medium text-stone-800">
                  {p.nombre}
                  {!p.disponible && (
                    <span className="ml-2 text-xs bg-stone-100 text-stone-400 px-1.5 py-0.5 rounded">no disponible</span>
                  )}
                </td>
                <td className="px-5 py-3 text-stone-500">{p.categoria || '—'}</td>
                <td className="px-5 py-3 text-right font-semibold text-forest">{fmt(p.precioVenta)}</td>
                <td className="px-5 py-3 text-right text-stone-500 text-xs">{p.costo > 0 ? fmt(p.costo) : '—'}</td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => handleToggleDisponibilidad(p)}
                      disabled={togglingDisp === p.id}
                      className={`text-xs transition-colors ${p.disponible ? 'text-stone-400 hover:text-amber-600' : 'text-amber-600 hover:text-forest'}`}
                    >
                      {togglingDisp === p.id ? '…' : p.disponible ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                    <button onClick={() => openReceta(p)} className="text-xs text-stone-400 hover:text-forest transition-colors">
                      Receta
                    </button>

                    <button onClick={() => openModificadores(p)} className="text-xs text-stone-400 hover:text-forest transition-colors">
                      Modificadores
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
            <div className="grid grid-cols-2 gap-3">
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
                <label className="label">Costo manual (MXN)</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costo}
                  onChange={(e) => setForm({ ...form, costo: e.target.value })}
                  placeholder="0.00"
                />
                <p className="text-xs text-stone-400 mt-1">La receta tiene prioridad si existe</p>
              </div>
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

      {/* Modificadores modal */}
      {modifProducto && (
        <Modal
          title={`Modificadores — ${modifProducto.nombre}`}
          onClose={() => setModifProducto(null)}
          size="md"
        >
          {modifLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6 text-forest" />
            </div>
          ) : todosGrupos.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-8">
              No hay grupos de modificadores. Créalos en la sección <strong>Modificadores</strong>.
            </p>
          ) : (
            <div className="space-y-2">
              {todosGrupos.map((g) => {
                const asignado = gruposAsignados.has(g.id)
                return (
                  <div key={g.id} className="flex items-center justify-between bg-surface-muted rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-stone-800">{g.nombre}</p>
                      <p className="text-xs text-stone-400">
                        {(g.opciones ?? []).length} opciones
                        {g.seleccionMin > 0 ? ` · mín. ${g.seleccionMin}` : ' · opcional'}
                        {` · máx. ${g.seleccionMax}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleToggleGrupo(g.id, asignado)}
                      disabled={toggling === g.id}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                        asignado ? 'bg-forest' : 'bg-stone-200'
                      }`}
                    >
                      {toggling === g.id ? (
                        <Spinner className="absolute inset-0 m-auto w-3 h-3 text-white" />
                      ) : (
                        <span
                          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                            asignado ? 'left-5' : 'left-0.5'
                          }`}
                        />
                      )}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </Modal>
      )}

      {/* Import modal */}
      {showImport && (
        <ImportarProductosModal
          onClose={() => setShowImport(false)}
          onSuccess={(result) => {
            setShowImport(false)
            setImportResult(result)
            cargar()
          }}
        />
      )}

      {/* Receta modal */}
      {recetaProducto && (
        <Modal title={`Receta — ${recetaProducto.nombre}`} onClose={() => setRecetaProducto(null)} size="lg">
          {recetaLoading ? (
            <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-forest" /></div>
          ) : (
            <div className="space-y-4">
              {recetaError && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{recetaError}</p>
              )}
              {/* Current recipe */}
              {receta.length > 0 ? (
                <div className="space-y-2">
                  {receta.map((l) => (
                    <div key={l.ingredienteId} className="flex items-center justify-between bg-surface-muted rounded-lg px-4 py-2.5">
                      <span className="text-sm text-stone-700">{l.ingredienteNombre}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-stone-500">{l.cantidad} {l.unidad}</span>
                        {l.mermaPorcentaje > 0 && (
                          <span className="text-xs bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded">
                            +{l.mermaPorcentaje}% merma
                          </span>
                        )}
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
              <div className="border-t border-stone-100 pt-4 space-y-2">
                <p className="text-xs font-medium text-stone-500">Agregar ingrediente</p>
                <div className="flex gap-2">
                  <SearchableSelect
                    className="flex-1"
                    options={ingredientes.map((i) => ({ value: String(i.id), label: `${i.nombre} (${i.unidad})` }))}
                    value={newRecetaLinea.ingredienteId}
                    onChange={(v) => setNewRecetaLinea({ ...newRecetaLinea, ingredienteId: v })}
                  />
                  <input
                    className="input w-24"
                    type="number" min="0" step="0.01"
                    placeholder="Cantidad"
                    value={newRecetaLinea.cantidad}
                    onChange={(e) => setNewRecetaLinea({ ...newRecetaLinea, cantidad: e.target.value })}
                  />
                  <div className="relative">
                    <input
                      className="input w-24 pr-7"
                      type="number" min="0" max="100" step="0.5"
                      placeholder="Merma"
                      title="% de merma (ej. 10 = 10% extra de consumo)"
                      value={newRecetaLinea.merma}
                      onChange={(e) => setNewRecetaLinea({ ...newRecetaLinea, merma: e.target.value })}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm pointer-events-none">%</span>
                  </div>
                  <button onClick={addRecetaLinea} className="btn-secondary px-3">+</button>
                </div>
              </div>

              {/* Plantillas */}
              {todasPlantillas.length > 0 && (
                <div className="border-t border-stone-100 pt-4">
                  <p className="text-xs font-medium text-stone-500 mb-2">Plantillas de ingredientes</p>
                  <div className="space-y-2">
                    {todasPlantillas.map((pl) => {
                      const sel = plantillasSeleccionadas.has(pl.id)
                      const exp = plantillasExpandidas.has(pl.id)
                      return (
                        <div key={pl.id} className={`rounded-lg border transition-colors ${sel ? 'border-forest/20 bg-forest/5' : 'border-stone-100 bg-surface-muted'}`}>
                          {/* Header row */}
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            {/* Expand toggle */}
                            <button
                              onClick={() => setPlantillasExpandidas((prev) => {
                                const next = new Set(prev)
                                exp ? next.delete(pl.id) : next.add(pl.id)
                                return next
                              })}
                              className="text-stone-400 hover:text-stone-600 shrink-0"
                            >
                              <svg className={`w-3.5 h-3.5 transition-transform ${exp ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                              </svg>
                            </button>
                            {/* Name */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-stone-700">{pl.nombre}</p>
                              {!exp && pl.ingredientes.length > 0 && (
                                <p className="text-xs text-stone-400 truncate">
                                  {pl.ingredientes.map((i) => i.ingredienteNombre).join(' · ')}
                                </p>
                              )}
                            </div>
                            {/* Toggle switch */}
                            <button
                              onClick={() => setPlantillasSeleccionadas((prev) => {
                                const next = new Set(prev)
                                sel ? next.delete(pl.id) : next.add(pl.id)
                                return next
                              })}
                              className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${sel ? 'bg-forest' : 'bg-stone-200'}`}
                            >
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${sel ? 'left-5' : 'left-0.5'}`} />
                            </button>
                          </div>
                          {/* Expandable ingredient list */}
                          {exp && (
                            <div className="border-t border-stone-100 px-3 pb-2.5 pt-2 space-y-1">
                              {pl.ingredientes.length === 0 ? (
                                <p className="text-xs text-stone-400 italic">Sin ingredientes</p>
                              ) : (
                                pl.ingredientes.map((i) => (
                                  <div key={i.id} className="flex items-center justify-between text-xs">
                                    <span className="text-stone-600">{i.ingredienteNombre}</span>
                                    <span className="text-stone-400">
                                      {i.cantidad} {i.unidad}
                                      {i.mermaPorcentaje > 0 && (
                                        <span className="ml-1 text-amber-500">+{i.mermaPorcentaje}%</span>
                                      )}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

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
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}
    </div>
  )
}
