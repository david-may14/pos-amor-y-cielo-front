import { useState, useEffect, useCallback } from 'react'
import { listarMovimientos, registrarCompra } from '../api/inventario'
import { listarIngredientes, listarIngredientesBasico } from '../api/ingredientes'
import { useAuth } from '../contexts/AuthContext'
import type { MovimientoInventario, Ingrediente, IngredienteBasico } from '../types/api'
import { MOVIMIENTOS } from '../utils/inventario'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'
import BuscadorIngrediente from '../components/BuscadorIngrediente'
import MovimientoIngredienteModal from '../components/MovimientoIngredienteModal'

/**
 * Inventario: el stock es el punto de partida, no una pestaña de consulta.
 *
 * Antes habia una pestaña por operacion —Compras, Ajustes, Produccion— y cada
 * una abria pidiendo el ingrediente en un desplegable de 68. Eso obligaba a
 * saber de antemano que se le iba a hacer y a reconocer el insumo por su
 * nombre, sin ver cuanto habia. Ahora se busca en la tabla, donde el stock
 * esta a la vista, y el panel del ingrediente ofrece todo lo que se le puede
 * hacer.
 *
 * Compras sobrevive como pestaña porque capturar una factura de doce cosas es
 * un trabajo distinto: ahi lo que estorba es abrir doce paneles, no elegir.
 */
type Tab = 'stock' | 'compras' | 'historial'

/** Una linea de la factura en captura. El nombre se resuelve desde la lista. */
interface LineaCompra {
  ingredienteId: number
  cantidad: string
  nota: string
}

export default function InventarioPage() {
  // El supervisor registra mermas y cuenta stock; compras y produccion son del admin.
  const { isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('stock')
  const [ingredientes, setIngredientes] = useState<IngredienteBasico[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toastMsg, setToastMsg] = useState('')
  const [busqueda, setBusqueda] = useState('')

  /** Ingrediente con el panel de movimientos abierto. */
  const [seleccionado, setSeleccionado] = useState<IngredienteBasico | null>(null)

  const [lineas, setLineas] = useState<LineaCompra[]>([])
  const [savingCompra, setSavingCompra] = useState(false)

  /** Recarga sin vaciar la pantalla: se usa despues de guardar algo. */
  const refrescar = useCallback(async () => {
    const [ings, movs] = await Promise.all([
      isAdmin ? listarIngredientes() : listarIngredientesBasico(),
      listarMovimientos(),
    ])
    setIngredientes(ings)
    setMovimientos(movs)
  }, [isAdmin])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      await refrescar()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [refrescar])

  useEffect(() => { cargar() }, [cargar])

  const handleRegistrado = async (mensaje: string) => {
    setSeleccionado(null)
    setError('')
    setToastMsg(mensaje)
    try {
      await refrescar()
    } catch {
      /* El movimiento ya quedo guardado; solo la vista queda vieja. */
    }
  }

  const agregarLinea = (ing: IngredienteBasico) =>
    setLineas((prev) => [...prev, { ingredienteId: ing.id, cantidad: '', nota: '' }])
  const quitarLinea = (id: number) =>
    setLineas((prev) => prev.filter((l) => l.ingredienteId !== id))
  const actualizarLinea = (id: number, campo: 'cantidad' | 'nota', valor: string) =>
    setLineas((prev) => prev.map((l) => (l.ingredienteId === id ? { ...l, [campo]: valor } : l)))

  const handleCompra = async () => {
    const validas = lineas.filter((l) => l.cantidad !== '' && !Number.isNaN(parseFloat(l.cantidad)))
    if (validas.length === 0) { setError('Escribe la cantidad de al menos un ingrediente'); return }
    setSavingCompra(true)
    setError('')
    setToastMsg('')
    try {
      await registrarCompra(validas.map((l) => ({
        ingredienteId: l.ingredienteId,
        cantidad: parseFloat(l.cantidad),
        ...(l.nota ? { nota: l.nota } : {}),
      })))
      setLineas([])
      setToastMsg(`Compra de ${validas.length} ingrediente${validas.length === 1 ? '' : 's'} registrada`)
      await refrescar()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar compra')
    } finally {
      setSavingCompra(false)
    }
  }

  const ingredientePorId = (id: number) => ingredientes.find((i) => i.id === id)
  const nombreIngrediente = (id: number) => ingredientePorId(id)?.nombre ?? `#${id}`

  /** La tabla de Stock: criticos primero, y filtrada por el buscador. */
  const visibles = [...ingredientes]
    .filter((i) => !busqueda.trim() || i.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    .sort((a, b) => {
      const aBajo = a.stockActual <= a.stockMinimo
      const bBajo = b.stockActual <= b.stockMinimo
      if (aBajo !== bBajo) return aBajo ? -1 : 1
      return a.nombre.localeCompare(b.nombre)
    })

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-forest" />
      </div>
    )
  }

  const columnas = isAdmin ? 6 : 5

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h1 className="text-xl font-semibold text-stone-800 mb-6">Inventario</h1>

      {/* Compras no es del supervisor: expone costos y proveedores. */}
      <div className="flex gap-1 bg-surface-muted rounded-xl p-1 w-full sm:w-fit mb-6 overflow-x-auto">
        {(([['stock', 'Stock'], ['compras', 'Compras'], ['historial', 'Historial']] as [Tab, string][])
          .filter(([t]) => isAdmin || t !== 'compras')
        ).map(([t, label]) => (
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

          <p className="text-sm text-stone-500">
            Toca un ingrediente para registrar una merma, corregir su stock
            {isAdmin && ', anotar una compra o producirlo'}.
          </p>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Ingrediente</th>
                  <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock actual</th>
                  <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Stock mín.</th>
                  {isAdmin && <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Costo unitario</th>}
                  <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Estado</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {ingredientes.length === 0 && (
                  <tr>
                    <td colSpan={columnas} className="px-5 py-12 text-center text-stone-400">
                      Sin ingredientes registrados
                    </td>
                  </tr>
                )}
                {ingredientes.length > 0 && visibles.length === 0 && (
                  <tr>
                    <td colSpan={columnas} className="px-5 py-12 text-center text-stone-400">
                      Sin resultados para "{busqueda}"
                    </td>
                  </tr>
                )}
                {visibles.map((ing) => {
                  const bajo = ing.stockActual <= ing.stockMinimo
                  const pct = ing.stockMinimo > 0
                    ? Math.min(100, Math.round((ing.stockActual / ing.stockMinimo) * 100))
                    : 100
                  return (
                    <tr
                      key={ing.id}
                      onClick={() => setSeleccionado(ing)}
                      className={`cursor-pointer hover:bg-surface-muted/50 ${bajo ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="px-5 py-3 font-medium text-stone-800">{ing.nombre}</td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${bajo ? 'text-amber-600' : 'text-stone-700'}`}>
                        {ing.stockActual} {ing.unidad}
                      </td>
                      <td className="px-5 py-3 text-right text-stone-400 tabular-nums">{ing.stockMinimo} {ing.unidad}</td>
                      {isAdmin && (
                        <td className="px-5 py-3 text-right text-stone-500 tabular-nums">
                          ${(ing as Ingrediente).costoUnitario}/{ing.unidad}
                        </td>
                      )}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bajo ? 'bg-amber-400' : 'bg-forest'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          {bajo && <span className="text-xs text-amber-600 font-medium">Stock bajo</span>}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className="text-xs font-medium text-forest whitespace-nowrap">
                          Registrar →
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'compras' && (
        <div className="card p-6 max-w-2xl">
          <p className="text-sm text-stone-500 mb-5">
            Entrada de ingredientes que <strong>le compraste a un proveedor</strong>. Suma al stock.
            Si lo produjiste tú, ábrelo desde Stock y usa <strong>Producir</strong>.
          </p>

          <BuscadorIngrediente
            ingredientes={ingredientes}
            excluirIds={lineas.map((l) => l.ingredienteId)}
            onElegir={agregarLinea}
            /* El foco se queda aqui a proposito: una factura son varios
               ingredientes seguidos, y las cantidades se llenan despues. */
            placeholder="Busca y presiona Enter para agregarlo…"
          />

          {lineas.length === 0 ? (
            <p className="text-sm text-stone-400 text-center py-10">
              Busca arriba los ingredientes que llegaron. Puedes agregar varios seguidos.
            </p>
          ) : (
            <div className="mt-5 space-y-3">
              {lineas.map((linea) => {
                const ing = ingredientePorId(linea.ingredienteId)
                return (
                  <div key={linea.ingredienteId} className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-stone-100 pb-3 sm:border-0 sm:pb-0">
                    <div className="sm:w-48 shrink-0">
                      <span className="text-sm font-medium text-stone-700">{ing?.nombre}</span>
                      <span className="text-xs text-stone-400 ml-1">({ing?.unidad})</span>
                    </div>
                    <div className="flex gap-2 items-center flex-1">
                      <input
                        className="input w-28"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Cantidad"
                        value={linea.cantidad}
                        onChange={(e) => actualizarLinea(linea.ingredienteId, 'cantidad', e.target.value)}
                      />
                      <input
                        className="input flex-1"
                        placeholder="Nota (proveedor, lote…)"
                        value={linea.nota}
                        onChange={(e) => actualizarLinea(linea.ingredienteId, 'nota', e.target.value)}
                      />
                      <button
                        onClick={() => quitarLinea(linea.ingredienteId)}
                        className="text-red-400 hover:text-red-600 text-lg px-2"
                        title="Quitar"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              })}
              <button
                onClick={handleCompra}
                disabled={savingCompra}
                className="btn-primary flex items-center gap-2 mt-2"
              >
                {savingCompra && <Spinner className="w-4 h-4 text-cream" />}
                {savingCompra ? 'Registrando…' : 'Registrar compra'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'historial' && (
        <div className="card overflow-x-auto">
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
                    <span className={`text-xs px-2 py-0.5 rounded-md whitespace-nowrap ${
                      MOVIMIENTOS[m.tipo]?.clase ?? 'bg-stone-100 text-stone-600'
                    }`}>
                      {MOVIMIENTOS[m.tipo]?.etiqueta ?? m.tipo}
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-right font-medium tabular-nums ${
                    m.cantidad < 0 ? 'text-red-600' : m.cantidad > 0 ? 'text-forest' : 'text-stone-500'
                  }`}>
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </td>
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

      {seleccionado && (
        <MovimientoIngredienteModal
          ingrediente={seleccionado}
          isAdmin={isAdmin}
          movimientos={movimientos}
          onCerrar={() => setSeleccionado(null)}
          onRegistrado={handleRegistrado}
        />
      )}
    </div>
  )
}
