import { useState, useEffect, useCallback } from 'react'
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  desactivarUsuario,
} from '../api/usuarios'
import type { UsuarioDTO, Rol } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

interface UsuarioForm {
  nombre: string
  email: string
  password: string
  rol: Rol
}

const emptyForm: UsuarioForm = { nombre: '', email: '', password: '', rol: 'BARISTA' }

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UsuarioDTO | null>(null)
  const [form, setForm] = useState<UsuarioForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      setUsuarios(await listarUsuarios())
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

  const openEdit = (u: UsuarioDTO) => {
    setEditing(u)
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol })
    setFormError('')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.nombre || !form.email || (!editing && !form.password)) {
      setFormError(editing ? 'Nombre y email son requeridos' : 'Todos los campos son requeridos')
      return
    }
    if (!editing && form.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        const updated = await actualizarUsuario(editing.id, {
          nombre: form.nombre,
          email: form.email,
          rol: form.rol,
        })
        setUsuarios((prev) => prev.map((u) => u.id === editing.id ? updated : u))
      } else {
        const created = await crearUsuario({
          nombre: form.nombre,
          email: form.email,
          password: form.password,
          rol: form.rol,
        })
        setUsuarios((prev) => [...prev, created])
      }
      setShowForm(false)
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDesactivar = async (u: UsuarioDTO) => {
    if (!confirm(`¿Desactivar a "${u.nombre}"?`)) return
    try {
      await desactivarUsuario(u.id)
      setUsuarios((prev) => prev.map((x) => x.id === u.id ? { ...x, activo: false } : x))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al desactivar')
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
        <h1 className="text-xl font-semibold text-stone-800">Usuarios</h1>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <span className="text-lg leading-none">+</span> Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-left">
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Nombre</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Email</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Rol</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Estado</th>
              <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Creado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {usuarios.map((u) => (
              <tr key={u.id} className={`hover:bg-surface-muted/50 ${!u.activo ? 'opacity-50' : ''}`}>
                <td className="px-5 py-3 font-medium text-stone-800">{u.nombre}</td>
                <td className="px-5 py-3 text-stone-500">{u.email}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-md ${
                    u.rol === 'ADMIN' ? 'bg-forest/10 text-forest font-medium' : 'bg-stone-100 text-stone-600'
                  }`}>
                    {u.rol}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-md ${
                    u.activo ? 'bg-green-50 text-green-700' : 'bg-stone-100 text-stone-400'
                  }`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-5 py-3 text-stone-400 text-xs">
                  {new Date(u.creadoEn).toLocaleDateString('es-MX')}
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => openEdit(u)} className="text-xs text-forest hover:underline">
                      Editar
                    </button>
                    {u.activo && (
                      <button onClick={() => handleDesactivar(u)} className="text-xs text-red-400 hover:text-red-600">
                        Desactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {usuarios.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-stone-400">
                  Sin usuarios registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setShowForm(false)}>
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
                placeholder="Nombre completo"
                autoFocus
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="correo@ejemplo.com"
              />
            </div>
            {!editing && (
              <div>
                <label className="label">Contraseña (mín. 8 caracteres)</label>
                <input
                  className="input"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                />
              </div>
            )}
            <div>
              <label className="label">Rol</label>
              <select
                className="input"
                value={form.rol}
                onChange={(e) => setForm({ ...form, rol: e.target.value as Rol })}
              >
                <option value="BARISTA">BARISTA</option>
                <option value="ADMIN">ADMIN</option>
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
    </div>
  )
}
