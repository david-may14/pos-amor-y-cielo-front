import { useState, useEffect, useCallback } from 'react'
import { listarMovimientos, registrarCompra, registrarAjuste } from '../api/inventario'
import { listarIngredientes, obtenerSubreceta, producirIngrediente } from '../api/ingredientes'
import type { MovimientoInventario, Ingrediente, TipoAjuste, SubrecetaDTO } from '../types/api'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'

type Tab = 'stock' | 'compras' | 'ajustes' | 'produccion' | 'historial'

interface LineaCompra {
  ingredienteId: string
  cantidad: string
  nota: string
}

export default function InventarioPage() {
  const [tab, setTab] = useState<Tab>('stock')
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // Compras form
  const [lineas, setLineas] = useState<LineaCompra[]>([{ ingredienteId: '', cantidad: '', nota: '' }])
  const [savingCompra, setSavingCompra] = useState(false)

  // Ajustes form
  const [ajuste, setAjuste] = useState({ ingredienteId: '', cantidad: '', tipo: 'AJUSTE' as TipoAjuste, nota: '' })
  const [savingAjuste, setSavingAjuste] = useState(false)

  // Producción form
  const [prodIngId, setProdIngId] = useState('')
  const [prodLotes, setProdLotes] = useState('1')
  const [prodSubreceta, setProdSubreceta] = useState<SubrecetaDTO | null>(null)
  const [prodLoadingSubreceta, setProdLoadingSubreceta] = useState(false)
  const [savingProd, setSavingProd] = useState(false)

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
    setToastMsg('')
    try {
      await registrarCompra(
        validas.map((l) => ({
          ingredienteId: parseInt(l.ingredienteId),
          cantidad: parseFloat(l.cantidad),
          ...(l.nota ? { nota: l.nota } : {}),
        }))
      )
      setLineas([{ ingredienteId: '', cantidad: '', nota: '' }])
      setToastMsg('Compra registrada correctamente')
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
    setToastMsg('')
    try {
      await registrarAjuste({
        ingredienteId: parseInt(ajuste.ingredienteId),
        cantidad: parseFloat(ajuste.cantidad),
        tipo: ajuste.tipo,
        ...(ajuste.nota ? { nota: ajuste.nota } : {}),
      })
      setAjuste({ ingredienteId: '', cantidad: '', tipo: 'AJUSTE', nota: '' })
      setToastMsg('Ajuste registrado correctamente')
      await recargarMovimientos()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar ajuste')
    } finally {
      setSavingAjuste(false)
    }
  }

  const handleSeleccionarElaborado = async (id: string) => {
    setProdIngId(id)
    setProdSubreceta(null)
    if (!id) return
    setProdLoadingSubreceta(true)
    try {
      const data = await obtenerSubreceta(parseInt(id))
      setProdSubreceta(data)
    } catch { /* ignore */ }
    finally { setProdLoadingSubreceta(false) }
  }

  const handleProducir = async () => {
    if (!prodIngId) { setError('Selecciona un ingrediente elaborado'); return }
    const lotes = parseFloat(prodLotes)
    if (isNaN(lotes) || lotes <= 0) { setError('Los lotes deben ser > 0'); return }
    setSavingProd(true)
    setError('')
    setToastMsg('')
    try {
      await producirIngrediente(parseInt(prodIngId), lotes)
      const ings = await listarIngredientes()
      setIngredientes(ings)
      setProdIngId('')
      setProdLotes('1')
      setProdSubreceta(null)
      setToastMsg('Producción registrada correctamente')
      await recargarMovimientos()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar producción')
    } finally {
      setSavingProd(false)
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
        {([['stock', 'Stock'], ['compras', 'Compras'], ['ajustes', 'Ajustes'], ['produccion', 'Producción'], ['historial', 'Historial']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); setToastMsg('') }}
            className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-white text-forest shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}

      {/* Stock actual */}
      {tab === 'stock' && (
        <div className="space-y-5">
          <div className="relative max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              className="input pl-9 text-sm py-2"
              placeholder="Buscar ingrediente…"
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
          <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 text-left">
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Ingrediente</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock actual</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock mín.</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Costo unitario</th>
                <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {ingredientes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-stone-400">
                    Sin ingredientes registrados
                  </td>
                </tr>
              )}
              {ingredientes.length > 0 && busqueda.trim() && [...ingredientes].filter((i) => i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-stone-400">
                    Sin resultados para "{busqueda}"
                  </td>
                </tr>
              )}
              {[...ingredientes]
                .filter((i) => !busqueda.trim() || i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
                .sort((a, b) => {
                  const aBajo = a.stockActual <= a.stockMinimo
                  const bBajo = b.stockActual <= b.stockMinimo
                  if (aBajo !== bBajo) return aBajo ? -1 : 1
                  return a.nombre.localeCompare(b.nombre)
                })
                .map((ing) => {
                  const bajo = ing.stockActual <= ing.stockMinimo
                  const pct = ing.stockMinimo > 0
                    ? Math.min(100, Math.round((ing.stockActual / ing.stockMinimo) * 100))
                    : 100
                  return (
                    <tr key={ing.id} className={`hover:bg-surface-muted/50 ${bajo ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-5 py-3 font-medium text-stone-800">{ing.nombre}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${bajo ? 'text-amber-600' : 'text-stone-700'}`}>
                        {ing.stockActual} {ing.unidad}
                      </td>
                      <td className="px-5 py-3 text-right text-stone-400">{ing.stockMinimo} {ing.unidad}</td>
                      <td className="px-5 py-3 text-right text-stone-500">
                        ${ing.costoUnitario}/{ing.unidad}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bajo ? 'bg-amber-400' : 'bg-forest'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {bajo && (
                            <span className="text-xs text-amber-600 font-medium">Stock bajo</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        </div>
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

      {/* Producción */}
      {tab === 'produccion' && (
        <div className="card p-6 max-w-lg">
          <p className="text-sm text-stone-500 mb-5">
            Registra la producción de un ingrediente elaborado. El sistema descontará los ingredientes base y sumará el resultado al stock.
          </p>
          <div className="space-y-4">
            <div>
              <label className="label">Ingrediente elaborado</label>
              <select
                className="input"
                value={prodIngId}
                onChange={(e) => handleSeleccionarElaborado(e.target.value)}
              >
                <option value="">Seleccionar…</option>
                {ingredientes.filter(i => i.rendimientoLote != null).map(i => (
                  <option key={i.id} value={i.id}>{i.nombre} ({i.stockActual} {i.unidad})</option>
                ))}
              </select>
              {ingredientes.filter(i => i.rendimientoLote != null).length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Ningún ingrediente tiene sub-receta. Define una en la pantalla de Ingredientes.
                </p>
              )}
            </div>

            {prodLoadingSubreceta && <div className="flex justify-center py-4"><Spinner className="w-5 h-5 text-forest" /></div>}

            {prodSubreceta && prodSubreceta.lineas.length > 0 && (
              <div className="bg-surface-muted rounded-xl p-4 space-y-3">
                <div>
                  <label className="label">Número de lotes</label>
                  <input
                    className="input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={prodLotes}
                    onChange={(e) => setProdLotes(e.target.value)}
                  />
                </div>

                <div className="border-t border-stone-200 pt-3 space-y-1">
                  <p className="text-xs font-medium text-stone-500 uppercase">Resumen de producción</p>
                  {prodSubreceta.lineas.map(l => {
                    const consumo = (l.cantidad * parseFloat(prodLotes || '0')).toFixed(3)
                    return (
                      <div key={l.baseId} className="flex justify-between text-sm">
                        <span className="text-stone-600">{l.baseNombre}</span>
                        <span className="text-red-600 font-medium">−{consumo} {l.baseUnidad}</span>
                      </div>
                    )
                  })}
                  <div className="flex justify-between text-sm border-t border-stone-200 pt-1 mt-1">
                    <span className="text-stone-600 font-medium">
                      {ingredientes.find(i => i.id === parseInt(prodIngId))?.nombre}
                    </span>
                    <span className="text-green-600 font-medium">
                      +{(prodSubreceta.rendimientoLote! * parseFloat(prodLotes || '0')).toFixed(3)} {prodSubreceta.unidad}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleProducir}
              disabled={savingProd || !prodIngId || !prodSubreceta}
              className="btn-primary w-full flex justify-center gap-2"
            >
              {savingProd && <Spinner className="w-4 h-4 text-cream" />}
              {savingProd ? 'Registrando…' : 'Registrar producción'}
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
