import { useState, useEffect, useCallback } from 'react'
import { listarMovimientos, registrarCompra, registrarAjuste } from '../api/inventario'
import { listarIngredientes } from '../api/ingredientes'
import type { MovimientoInventario, Ingrediente, TipoAjuste } from '../types/api'
import Spinner from '../components/Spinner'

type Tab = 'compras' | 'ajustes' | 'historial'

interface LineaCompra {
  ingredienteId: string
  cantidad: string
  nota: string
}

export default function InventarioPage() {
  const [tab, setTab] = useState<Tab>('compras')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Compras form
  const [lineas, setLineas] = useState<LineaCompra[]>([{ ingredienteId: '', cantidad: '', nota: '' }])
  const [savingCompra, setSavingCompra] = useState(false)

  // Ajustes form
  const [ajuste, setAjuste] = useState({ ingredienteId: '', cantidad: '', tipo: 'AJUSTE' as TipoAjuste, nota: '' })
  const [savingAjuste, setSavingAjuste] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [ings, movs] = await Promise.all([listarIngredientes(), listarMovimientos()])
      setIngredientes(ings)
      setMovimientos(movs)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const recargarMovimientos = async () => {
    const movs = await listarMovimientos()
    setMovimientos(movs)
  }

  const handleCompra = async () => {
    const validas = lineas.filter((l) => l.ingredienteId && l.cantidad)
    if (validas.length === 0) { setError('Agrega al menos una línea de compra'); return }
    setSavingCompra(true)
    setError('')
    setSuccess('')
    try {
      await registrarCompra(
        validas.map((l) => ({
          ingredienteId: parseInt(l.ingredienteId),
          cantidad: parseFloat(l.cantidad),
          ...(l.nota ? { nota: l.nota } : {}),
        }))
      )
      setLineas([{ ingredienteId: '', cantidad: '', nota: '' }])
      setSuccess('Compra registrada correctamente')
      await recargarMovimientos()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar compra')
    } finally {
      setSavingCompra(false)
    }
  }

  const handleAjuste = async () => {
    if (!ajuste.ingredienteId || !ajuste.cantidad) { setError('Ingrediente y cantidad son requeridos'); return }
    setSavingAjuste(true)
    setError('')
    setSuccess('')
    try {
      await registrarAjuste({
        ingredienteId: parseInt(ajuste.ingredienteId),
        cantidad: parseFloat(ajuste.cantidad),
        tipo: ajuste.tipo,
        ...(ajuste.nota ? { nota: ajuste.nota } : {}),
      })
      setAjuste({ ingredienteId: '', cantidad: '', tipo: 'AJUSTE', nota: '' })
      setSuccess('Ajuste registrado correctamente')
      await recargarMovimientos()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar ajuste')
    } finally {
      setSavingAjuste(false)
    }
  }

  const addLinea = () => setLineas((prev) => [...prev, { ingredienteId: '', cantidad: '', nota: '' }])
  const removeLinea = (i: number) => setLineas((prev) => prev.filter((_, idx) => idx !== i))
  const updateLinea = (i: number, field: keyof LineaCompra, value: string) =>
    setLineas((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l))

  const nombreIngrediente = (id: number) =>
    ingredientes.find((i) => i.id === id)?.nombre ?? `#${id}`

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-forest" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-xl font-semibold text-stone-800 mb-6">Inventario</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-muted rounded-xl p-1 w-fit mb-6">
        {(['compras', 'ajustes', 'historial'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); setSuccess('') }}
            className={`px-5 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              tab === t ? 'bg-white text-forest shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 text-sm rounded-lg px-4 py-3 mb-5">{success}</div>
      )}

      {/* Compras */}
      {tab === 'compras' && (
        <div className="card p-6 max-w-2xl">
          <p className="text-sm text-stone-500 mb-5">
            Registra una entrada de ingredientes. El stock se actualiza automáticamente.
          </p>
          <div className="space-y-3">
            {lineas.map((linea, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  {i === 0 && <label className="label">Ingrediente</label>}
                  <select
                    className="input"
                    value={linea.ingredienteId}
                    onChange={(e) => updateLinea(i, 'ingredienteId', e.target.value)}
                  >
                    <option value="">Seleccionar…</option>
                    {ingredientes.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.nombre} ({ing.unidad})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28">
                  {i === 0 && <label className="label">Cantidad</label>}
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={linea.cantidad}
                    onChange={(e) => updateLinea(i, 'cantidad', e.target.value)}
                  />
                </div>
                <div className="flex-1">
                  {i === 0 && <label className="label">Nota (opcional)</label>}
                  <input
                    className="input"
                    placeholder="Proveedor, lote…"
                    value={linea.nota}
                    onChange={(e) => updateLinea(i, 'nota', e.target.value)}
                  />
                </div>
                {lineas.length > 1 && (
                  <button
                    onClick={() => removeLinea(i)}
                    className="text-red-400 hover:text-red-600 pb-2 text-lg"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={addLinea} className="btn-secondary flex items-center gap-1">
              <span className="text-lg leading-none">+</span> Agregar línea
            </button>
            <button onClick={handleCompra} disabled={savingCompra} className="btn-primary flex items-center gap-2">
              {savingCompra && <Spinner className="w-4 h-4 text-cream" />}
              {savingCompra ? 'Registrando…' : 'Registrar compra'}
            </button>
          </div>
        </div>
      )}

      {/* Ajustes */}
      {tab === 'ajustes' && (
        <div className="card p-6 max-w-md">
          <p className="text-sm text-stone-500 mb-5">
            Registra mermas, pérdidas o correcciones de inventario.
          </p>
          <div className="space-y-4">
            <div>
              <label className="label">Ingrediente</label>
              <select
                className="input"
                value={ajuste.ingredienteId}
                onChange={(e) => setAjuste({ ...ajuste, ingredienteId: e.target.value })}
              >
                <option value="">Seleccionar…</option>
                {ingredientes.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.nombre} ({ing.stockActual} {ing.unidad})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Tipo</label>
                <select
                  className="input"
                  value={ajuste.tipo}
                  onChange={(e) => setAjuste({ ...ajuste, tipo: e.target.value as TipoAjuste })}
                >
                  <option value="AJUSTE">Ajuste</option>
                  <option value="MERMA">Merma</option>
                </select>
              </div>
              <div>
                <label className="label">Cantidad</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={ajuste.cantidad}
                  onChange={(e) => setAjuste({ ...ajuste, cantidad: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="label">Nota (opcional)</label>
              <input
                className="input"
                placeholder="Motivo del ajuste…"
                value={ajuste.nota}
                onChange={(e) => setAjuste({ ...ajuste, nota: e.target.value })}
              />
            </div>
            <button onClick={handleAjuste} disabled={savingAjuste} className="btn-primary w-full flex justify-center gap-2">
              {savingAjuste && <Spinner className="w-4 h-4 text-cream" />}
              {savingAjuste ? 'Registrando…' : 'Registrar ajuste'}
            </button>
          </div>
        </div>
      )}

      {/* Historial */}
      {tab === 'historial' && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Fecha</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Ingrediente</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Tipo</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Cantidad</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {movimientos.map((m) => (
                <tr key={m.id} className="hover:bg-surface-muted/50">
                  <td className="px-5 py-3 text-stone-500">
                    {new Date(m.creadoEn).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-5 py-3 font-medium text-stone-700">{nombreIngrediente(m.ingredienteId)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-md ${
                      m.tipo === 'COMPRA'
                        ? 'bg-green-50 text-green-700'
                        : m.tipo === 'VENTA'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {m.tipo}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-stone-700">{m.cantidad}</td>
                  <td className="px-5 py-3 text-stone-400 text-xs">{m.nota ?? '—'}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-stone-400">
                    Sin movimientos registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
