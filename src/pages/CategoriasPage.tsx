import { useState, useEffect, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from '../api/categorias'
import type { Categoria } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

// ─── Fila arrastrable ────────────────────────────────────────────────────────

interface RowProps {
  categoria: Categoria
  onEdit: (c: Categoria) => void
  onDelete: (c: Categoria) => void
}

function CategoriaRow({ categoria, onEdit, onDelete }: RowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: categoria.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-stone-100 shadow-sm"
    >
      {/* Grip handle */}
      <button
        {...attributes}
        {...listeners}
        className="text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing touch-none"
        tabIndex={-1}
        aria-label="Arrastrar para reordenar"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M8.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM15.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM15.5 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM15.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        </svg>
      </button>

      <span className="flex-1 text-sm font-medium text-stone-800">{categoria.nombre}</span>

      <div className="flex items-center gap-3">
        <button onClick={() => onEdit(categoria)} className="text-xs text-forest hover:underline">
          Editar
        </button>
        <button onClick={() => onDelete(categoria)} className="text-xs text-red-400 hover:text-red-600">
          Eliminar
        </button>
      </div>
    </div>
  )
}

// ─── Página ──────────────────────────────────────────────────────────────────

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Categoria | null>(null)
  const [nombre, setNombre] = useState('')
  const [formError, setFormError] = useState('')
  const [formSaving, setFormSaving] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listarCategorias()
      setCategorias([...data].sort((a, b) => a.orden - b.orden))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Guarda el nuevo orden en el backend
  const persistOrden = async (ordered: Categoria[]) => {
    setSaving(true)
    try {
      await Promise.all(
        ordered.map((c, idx) =>
          c.orden !== idx ? actualizarCategoria(c.id, { nombre: c.nombre, orden: idx }) : Promise.resolve(c)
        )
      )
      setCategorias(ordered.map((c, idx) => ({ ...c, orden: idx })))
    } catch {
      setError('Error al guardar el orden')
    } finally {
      setSaving(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = categorias.findIndex((c) => c.id === active.id)
    const newIndex = categorias.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(categorias, oldIndex, newIndex)
    setCategorias(reordered) // optimistic
    persistOrden(reordered)
  }

  const openCreate = () => {
    setEditing(null)
    setNombre('')
    setFormError('')
    setShowForm(true)
  }

  const openEdit = (c: Categoria) => {
    setEditing(c)
    setNombre(c.nombre)
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    const nombreTrim = nombre.trim()
    if (!nombreTrim) { setFormError('El nombre es requerido'); return }

    setFormSaving(true)
    setFormError('')
    try {
      const orden = editing ? editing.orden : categorias.length
      if (editing) {
        const updated = await actualizarCategoria(editing.id, { nombre: nombreTrim, orden })
        setCategorias((prev) => prev.map((c) => (c.id === editing.id ? updated : c)))
      } else {
        const created = await crearCategoria({ nombre: nombreTrim, orden })
        setCategorias((prev) => [...prev, created])
      }
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setFormSaving(false)
    }
  }

  const handleEliminar = async (c: Categoria) => {
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"? Los productos quedarán sin categoría.`)) return
    try {
      await eliminarCategoria(c.id)
      setCategorias((prev) => prev.filter((x) => x.id !== c.id))
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
          <h1 className="text-xl font-semibold text-stone-800">Categorías</h1>
          <p className="text-sm text-stone-400 mt-0.5">
            Arrastra para cambiar el orden en que aparecen en el menú
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saving && <Spinner className="w-4 h-4 text-forest" />}
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <span className="text-lg leading-none">+</span> Nueva categoría
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      {categorias.length === 0 ? (
        <div className="card px-6 py-16 text-center text-stone-400 text-sm">
          Sin categorías. Crea una para comenzar.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categorias.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2 max-w-lg">
              {categorias.map((c) => (
                <CategoriaRow
                  key={c.id}
                  categoria={c}
                  onEdit={openEdit}
                  onDelete={handleEliminar}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showForm && (
        <Modal
          title={editing ? 'Editar categoría' : 'Nueva categoría'}
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
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Cold Brew, Latte, Frappé…"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleSave} disabled={formSaving} className="btn-primary flex-1 flex justify-center gap-2">
                {formSaving && <Spinner className="w-4 h-4 text-cream" />}
                {formSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
