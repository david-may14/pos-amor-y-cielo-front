import { useState, useEffect, useCallback, useMemo } from 'react'
import { listarVentas, resumenDia, anularVenta, listarAnulaciones } from '../api/ventas'
import { MOTIVOS_ANULACION, ETIQUETA_MOTIVO } from '../types/api'
import type { MotivoAnulacion, AnulacionDTO, VentaResponse, ResumenDia } from '../types/api'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'
import { hoy, diasAtras } from '../utils/fecha'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)



type DisplayItem =
  | { kind: 'solo'; venta: VentaResponse }
  | { kind: 'group-header'; grupo: string; miembros: VentaResponse[]; refId: number }
  | { kind: 'sub'; venta: VentaResponse; idx: number; count: number; refId: number }

/**
 * Rangos de uso diario. Se calculan al pulsar, no al cargar: la pantalla se
 * queda abierta toda la tarde, y con "hoy" congelado al abrirla dejaría de
 * apuntar al día correcto pasada la medianoche.
 */
const ATAJOS: { etiqueta: string; rango: () => [string, string] }[] = [
  { etiqueta: 'Hoy', rango: () => [hoy(), hoy()] },
  { etiqueta: 'Ayer', rango: () => { const a = diasAtras(1); return [a, a] } },
  { etiqueta: 'Últimos 7 días', rango: () => [diasAtras(6), hoy()] },
  { etiqueta: 'Este mes', rango: () => [hoy().slice(0, 8) + '01', hoy()] },
]

export default function VentasPage() {
  // isAdmin sigue protegiendo costos, utilidad y propinas: un supervisor
  // opera el turno pero no ve lo que gana el negocio.
  const { isAdmin, puedeSupervisar } = useAuth()
  const [desde, setDesde] = useState(hoy())
  const [hasta, setHasta] = useState(hoy())
  const [ventas, setVentas] = useState<VentaResponse[]>([])
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<VentaResponse | null>(null)
  const [anulando, setAnulando] = useState<number | null>(null)
  const [porAnular, setPorAnular] = useState<VentaResponse | null>(null)
  const [verBitacora, setVerBitacora] = useState(false)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [v, r] = await Promise.all([listarVentas(desde, hasta), resumenDia(desde, hasta)])
      setVentas(v)
      setResumen(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const displayItems = useMemo<DisplayItem[]>(() => {
    const byGrupo = new Map<string, VentaResponse[]>()
    ventas.forEach(v => {
      if (v.splitGrupo) {
        const arr = byGrupo.get(v.splitGrupo) ?? []
        arr.push(v)
        byGrupo.set(v.splitGrupo, arr)
      }
    })
    const seen = new Set<string>()
    const items: DisplayItem[] = []
    ventas.forEach(v => {
      if (!v.splitGrupo) {
        items.push({ kind: 'solo', venta: v })
      } else if (!seen.has(v.splitGrupo)) {
        seen.add(v.splitGrupo)
        const miembros = byGrupo.get(v.splitGrupo)!
        const refId = Math.min(...miembros.map(m => m.id))
        items.push({ kind: 'group-header', grupo: v.splitGrupo, miembros, refId })
        miembros.forEach((m, i) => items.push({ kind: 'sub', venta: m, idx: i + 1, count: miembros.length, refId }))
      }
    })
    return items
  }, [ventas])

  // Ya no basta con un confirm(): anular exige motivo, y ese motivo es lo que
  // convierte la operacion en algo auditable.
  const handleAnular = (v: VentaResponse) => setPorAnular(v)

  const confirmarAnulacion = async (motivo: MotivoAnulacion, nota: string) => {
    const v = porAnular
    if (!v) return
    setAnulando(v.id)
    setError('')
    try {
      const actualizada = await anularVenta(v.id, motivo, nota.trim() || undefined)
      setVentas((prev) => prev.map((x) => x.id === v.id ? actualizada : x))
      if (detalle?.id === v.id) setDetalle(actualizada)
      setPorAnular(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al anular')
    } finally {
      setAnulando(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-semibold text-stone-800">Ventas</h1>
        {puedeSupervisar && (
          <div className="flex items-center gap-2">
            {/* Una bitacora que nadie puede leer no es un control. */}
            <button onClick={() => setVerBitacora(true)} className="btn-secondary text-sm">
              Anulaciones
            </button>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={desde}
                max={hasta}
                onChange={(e) => setDesde(e.target.value)}
                className="input w-auto text-sm"
                aria-label="Desde"
              />
              <span className="text-stone-400 text-sm">a</span>
              <input
                type="date"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
                className="input w-auto text-sm"
                aria-label="Hasta"
              />
            </div>
          </div>
        )}
      </div>

      {/* Atajos: teclear dos fechas para ver "la semana" es justo la fricción
          que hace que nadie mire más allá de hoy. */}
      {puedeSupervisar && (
        <div className="flex flex-wrap gap-2 mb-5">
          {ATAJOS.map((a) => {
            const [d, h] = a.rango()
            const activo = d === desde && h === hasta
            return (
              <button
                key={a.etiqueta}
                onClick={() => { setDesde(d); setHasta(h) }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activo
                    ? 'bg-forest text-white border-forest'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                }`}
              >
                {a.etiqueta}
              </button>
            )
          })}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner className="w-8 h-8 text-forest" />
        </div>
      ) : (
        <>
          {/* Resumen cards */}
          {resumen && (
            <>
              <div className={`grid gap-4 mb-3 ${isAdmin ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2'}`}>
                <ResumenCard label="Ventas" value={String(resumen.totalVentas)} />
                <ResumenCard label={isAdmin ? 'Ingresos' : 'Total de Ventas'} value={fmt(resumen.ingresos)} highlight />
                {isAdmin && <ResumenCard label="Costos" value={fmt(resumen.costos)} />}
                {isAdmin && <ResumenCard label="Utilidad neta" value={fmt(resumen.utilidad)} green />}
              </div>
              {isAdmin && (resumen.totalIva > 0 || resumen.totalComisiones > 0) && (
                <div className="card px-5 py-3 mb-6 flex gap-6 flex-wrap text-xs">
                  <span className="text-stone-400">Desglose fiscal:</span>
                  {resumen.totalIva > 0 && (
                    <span className="text-stone-500">
                      IVA incluido: <span className="font-semibold text-stone-700">{fmt(resumen.totalIva)}</span>
                    </span>
                  )}
                  {resumen.totalComisiones > 0 && (
                    <span className="text-stone-500">
                      Comisiones tarjeta: <span className="font-semibold text-red-500">{fmt(resumen.totalComisiones)}</span>
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {/* Métodos de pago */}
          {resumen && Object.keys(resumen.ventasPorMetodoPago).length > 0 && (
            <div className="card px-5 py-4 mb-6 flex gap-6 flex-wrap">
              {Object.entries(resumen.ventasPorMetodoPago).map(([metodo, count]) => (
                <div key={metodo}>
                  <p className="text-xs text-stone-400">{metodo}</p>
                  <p className="text-sm font-semibold text-stone-700">{count} ventas</p>
                </div>
              ))}
            </div>
          )}

          {/* Propinas por barista — solo ADMIN */}
          {isAdmin && (() => {
            const activas = ventas.filter(v => v.estado !== 'ANULADA')
            const byBarista: Record<string, { ventas: number; propinas: number }> = {}
            activas.forEach(v => {
              const nombre = v.usuarioNombre ?? '—'
              if (!byBarista[nombre]) byBarista[nombre] = { ventas: 0, propinas: 0 }
              byBarista[nombre].ventas++
              byBarista[nombre].propinas += parseFloat(String(v.propina ?? 0))
            })
            const rows = Object.entries(byBarista)
            if (rows.length === 0) return null
            const totalPropinas = rows.reduce((s, [, d]) => s + d.propinas, 0)
            return (
              <div className="card overflow-x-auto mb-6">
                <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-stone-700">Propinas por barista</h2>
                  <span className="text-xs text-stone-400">Solo ventas completadas</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-100 text-left">
                      <th className="px-5 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide">Barista</th>
                      <th className="px-5 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide text-center">Ventas</th>
                      <th className="px-5 py-2 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Propinas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {rows.sort((a, b) => b[1].propinas - a[1].propinas).map(([nombre, data]) => (
                      <tr key={nombre} className="hover:bg-surface-muted/40">
                        <td className="px-5 py-2.5 font-medium text-stone-700">👤 {nombre}</td>
                        <td className="px-5 py-2.5 text-stone-500 text-center">{data.ventas}</td>
                        <td className="px-5 py-2.5 text-right font-semibold text-forest">{fmt(data.propinas)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-stone-100 bg-stone-50">
                      <td className="px-5 py-2.5 text-xs font-semibold text-stone-500 uppercase">Total</td>
                      <td className="px-5 py-2.5 text-center text-xs text-stone-400">{activas.length}</td>
                      <td className="px-5 py-2.5 text-right font-bold text-stone-800">{fmt(totalPropinas)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )
          })()}

          {/* Tabla de ventas */}
          {ventas.length === 0 ? (
            <div className="card px-6 py-16 text-center text-stone-400 text-sm">
              {desde === hasta
                ? 'No hay ventas registradas para esta fecha.'
                : 'No hay ventas registradas en este periodo.'}
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide"># Venta</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Hora</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Barista</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Items</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Método</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Total</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {displayItems.map((row) => {
                    if (row.kind === 'group-header') {
                      const totalGrupo = row.miembros.reduce((s, m) => s + m.total, 0)
                      const hora = new Date(row.miembros[0].creadaEn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                      return (
                        <tr key={`gh-${row.grupo}`} className="bg-amber-50/70 border-b-0">
                          <td colSpan={7} className="px-5 py-2">
                            <div className="flex items-center gap-3 text-xs">
                              <span className="font-semibold text-amber-700">Cuenta #{row.refId}</span>
                              <span className="bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-medium">dividida en {row.miembros.length}</span>
                              <span className="text-stone-400">{hora}</span>
                              <span className="ml-auto font-semibold text-stone-600">{fmt(totalGrupo)} total</span>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    const v = row.venta
                    const anulada = v.estado === 'ANULADA'
                    const isSub = row.kind === 'sub'
                    const displayId = isSub ? `${row.refId}-${row.idx}` : String(v.id)
                    return (
                      <tr key={v.id} className={`transition-colors ${anulada ? 'bg-red-50/50 opacity-60' : isSub ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-surface-muted/50'}`}>
                        <td className="py-3 font-medium text-stone-700" style={{ paddingLeft: isSub ? '2rem' : '1.25rem', paddingRight: '1.25rem' }}>
                          {isSub && <span className="text-amber-300 mr-1 text-xs">└</span>}
                          #{displayId}
                          {anulada && (
                            <span className="ml-2 text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-medium">anulada</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-stone-500">
                          {new Date(v.creadaEn).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3">
                          {v.usuarioNombre
                            ? <span className="text-xs font-medium text-stone-600">{v.usuarioNombre}</span>
                            : <span className="text-xs text-stone-300">—</span>
                          }
                        </td>
                        <td className="px-5 py-3 text-stone-500">{v.items.length}</td>
                        <td className="px-5 py-3">
                          <span className="inline-block bg-surface-muted text-stone-600 text-xs px-2 py-0.5 rounded-md">
                            {v.metodoPago}
                          </span>
                        </td>
                        <td className={`px-5 py-3 text-right font-semibold ${anulada ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                          {fmt(v.total)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => setDetalle(v)} className="text-xs text-forest hover:underline">
                              Ver detalle
                            </button>
                            {/* Antes se mostraba a cualquiera y el servidor lo
                                rechazaba: un boton que siempre falla. */}
                            {puedeSupervisar && !anulada && (
                              <button
                                onClick={() => handleAnular(v)}
                                disabled={anulando === v.id}
                                className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50"
                              >
                                {anulando === v.id ? '…' : 'Anular'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Detalle modal */}
      {detalle && (
        <Modal
          title={`Venta #${detalle.id}`}
          onClose={() => setDetalle(null)}
          size="sm"
        >
          <div className="space-y-4">
            {/* Cabecera: fecha, método, estado */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-500">{new Date(detalle.creadaEn).toLocaleString('es-MX')}</span>
              <div className="flex items-center gap-2">
                <span className="bg-surface-muted text-stone-600 text-xs px-2 py-0.5 rounded-md font-medium">
                  {detalle.metodoPago}
                </span>
                {detalle.estado === 'ANULADA' && (
                  <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-md font-medium">ANULADA</span>
                )}
              </div>
            </div>
            {detalle.usuarioNombre && (
              <div className="flex items-center gap-2 text-sm text-stone-500 bg-stone-50 rounded-lg px-3 py-2">
                <span>👤</span>
                <span>
                  {detalle.estado === 'ANULADA' ? 'Anulada por' : 'Vendido por'}
                  <span className="font-semibold text-stone-700 ml-1">{detalle.usuarioNombre}</span>
                </span>
              </div>
            )}
            {detalle.splitGrupo && (() => {
              const hermanas = ventas.filter(x => x.splitGrupo === detalle.splitGrupo)
              const refId = Math.min(...hermanas.map(x => x.id))
              const idx = hermanas.findIndex(x => x.id === detalle.id) + 1
              return (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                  <span className="font-medium">Cuenta #{refId}-{idx} de {hermanas.length}</span>
                </div>
              )
            })()}

            {/* Ítems */}
            <div className="space-y-3 border-t border-stone-100 pt-3">
              {detalle.items.map((item, i) => {
                const bruto = item.precioUnitario * item.cantidad
                const descMonto = item.descuentoMonto ?? 0
                const neto = bruto - descMonto
                const tieneDescuento = item.descuentoNombre != null && descMonto > 0
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-stone-700">{item.cantidad}× {item.nombreProducto}</span>
                      <span className={tieneDescuento ? 'text-stone-400 line-through text-xs self-center' : 'font-medium text-stone-800'}>
                        {fmt(bruto)}
                      </span>
                    </div>
                    {item.modificadores.length > 0 && (
                      <div className="mt-0.5 space-y-0.5 pl-3">
                        {item.modificadores.map((m, j) => (
                          <p key={j} className="text-xs text-stone-400">
                            + {m.nombre}{m.precioExtra > 0 ? ` · +${fmt(m.precioExtra)}` : ''}
                          </p>
                        ))}
                      </div>
                    )}
                    {item.notas && (
                      <p className="text-xs text-stone-400 italic pl-3 mt-0.5">"{item.notas}"</p>
                    )}
                    {tieneDescuento && (
                      <div className="pl-3 mt-1 space-y-0.5">
                        <div className="flex justify-between text-xs text-emerald-600">
                          <span>Desc. {item.descuentoNombre}</span>
                          <span>−{fmt(descMonto)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-stone-800">
                          <span className="text-xs text-stone-400 font-normal">Subtotal</span>
                          <span>{fmt(neto)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Totales */}
            <div className="border-t border-stone-100 pt-3 space-y-1.5">
              {detalle.descuentoTicketNombre && detalle.descuentoTicketMonto != null && detalle.descuentoTicketMonto > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Desc. {detalle.descuentoTicketNombre}</span>
                  <span>−{fmt(detalle.descuentoTicketMonto)}</span>
                </div>
              )}
              {detalle.propina > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Propina</span>
                  <span>+{fmt(detalle.propina)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-stone-400">
                <span>Costo</span>
                <span>{fmt(detalle.costoTotal)}</span>
              </div>
              {isAdmin && detalle.ivaMonto > 0 && (
                <div className="flex justify-between text-sm text-stone-400">
                  <span>IVA incluido ({((detalle.ivaMonto / detalle.total) * 100).toFixed(1)}%)</span>
                  <span>{fmt(detalle.ivaMonto)}</span>
                </div>
              )}
              {isAdmin && detalle.comisionMonto > 0 && (
                <div className="flex justify-between text-sm text-red-400">
                  <span>Comisión terminal</span>
                  <span>−{fmt(detalle.comisionMonto)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-stone-100">
                <span>Total</span>
                <span className={detalle.estado === 'ANULADA' ? 'line-through text-stone-400' : 'text-forest'}>
                  {fmt(detalle.total + (detalle.propina ?? 0))}
                </span>
              </div>
            </div>

            {/* Acción anular */}
            {puedeSupervisar && detalle.estado !== 'ANULADA' && (
              <button
                onClick={() => handleAnular(detalle)}
                disabled={anulando === detalle.id}
                className="w-full text-sm text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 rounded-xl py-2 transition-colors disabled:opacity-50"
              >
                {anulando === detalle.id ? 'Anulando…' : 'Anular esta venta'}
              </button>
            )}
          </div>
        </Modal>
      )}

      {porAnular && (
        <ModalAnular
          venta={porAnular}
          anulando={anulando === porAnular.id}
          onConfirmar={confirmarAnulacion}
          onCerrar={() => setPorAnular(null)}
        />
      )}

      {verBitacora && <PanelBitacora fecha={hasta} onCerrar={() => setVerBitacora(false)} />}
    </div>
  )
}

interface ModalAnularProps {
  venta: VentaResponse
  anulando: boolean
  onConfirmar: (motivo: MotivoAnulacion, nota: string) => void
  onCerrar: () => void
}

/**
 * Pide el motivo antes de anular.
 *
 * Sustituye al confirm() del navegador a proposito: la friccion es la funcion.
 * Anular deshace un cobro y devuelve inventario, y quien lo hace queda
 * registrado con nombre y motivo.
 */
function ModalAnular({ venta, anulando, onConfirmar, onCerrar }: ModalAnularProps) {
  const [motivo, setMotivo] = useState<MotivoAnulacion | ''>('')
  const [nota, setNota] = useState('')

  // "Otro" sin explicacion no informa de nada, que es justo lo que la bitacora
  // existe para evitar. El resto de motivos ya se explican con su categoria.
  const faltaExplicacion = motivo === 'OTRO' && !nota.trim()
  const puedeAnular = motivo !== '' && !faltaExplicacion && !anulando

  return (
    <Modal title={`Anular venta #${venta.id}`} onClose={onCerrar} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          Se devolverá <span className="font-semibold">{fmt(venta.total)}</span> y se restaurará
          el inventario. Queda registrado quién anula y por qué.
        </p>

        <div>
          <label className="label">Motivo</label>
          <select
            className="input"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value as MotivoAnulacion)}
            autoFocus
          >
            <option value="">Elige un motivo…</option>
            {MOTIVOS_ANULACION.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">
            Detalle {motivo === 'OTRO' ? '' : <span className="text-stone-400">(opcional)</span>}
          </label>
          <input
            className="input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={motivo === 'OTRO' ? 'Explica qué pasó' : 'Añade contexto si hace falta'}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCerrar} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => motivo && onConfirmar(motivo, nota)}
            disabled={!puedeAnular}
            className="btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {anulando ? 'Anulando…' : 'Anular venta'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** La bitácora del mes en curso hasta la fecha seleccionada. */
function PanelBitacora({ fecha, onCerrar }: { fecha: string; onCerrar: () => void }) {
  const [registros, setRegistros] = useState<AnulacionDTO[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const desde = fecha.slice(0, 8) + '01'
    listarAnulaciones(desde, fecha)
      .then(setRegistros)
      .catch(() => setError('No se pudo cargar la bitácora'))
      .finally(() => setCargando(false))
  }, [fecha])

  const total = registros.reduce((s, r) => s + r.totalAnulado, 0)

  return (
    <Modal title="Anulaciones del mes" onClose={onCerrar} size="lg">
      {cargando ? (
        <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-forest" /></div>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : registros.length === 0 ? (
        <p className="text-sm text-stone-400 py-6 text-center">
          Sin anulaciones registradas este mes.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-stone-500">{registros.length} anulaciones</p>
            <p className="text-sm">
              <span className="text-stone-500">Total anulado </span>
              <span className="font-semibold text-stone-800">{fmt(total)}</span>
            </p>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {registros.map((r) => (
              <div key={r.id} className="border border-stone-100 rounded-lg px-3 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-stone-800">
                    {ETIQUETA_MOTIVO[r.motivo]}
                  </span>
                  <span className="text-sm font-semibold text-stone-700">{fmt(r.totalAnulado)}</span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Venta #{r.ventaId} · {new Date(r.ocurridoEn).toLocaleString('es-MX', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
                  })}
                  {r.anuladaPor && <> · anuló <span className="text-stone-600">{r.anuladaPor}</span></>}
                  {r.vendedor && <> · vendió <span className="text-stone-600">{r.vendedor}</span></>}
                </p>
                {r.nota && <p className="text-xs text-stone-600 mt-1 italic">{r.nota}</p>}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-stone-400">
            Las ventas anuladas antes de que existiera esta bitácora no aparecen aquí.
          </p>
        </div>
      )}
    </Modal>
  )
}

function ResumenCard({
  label,
  value,
  highlight,
  green,
}: {
  label: string
  value: string
  highlight?: boolean
  green?: boolean
}) {
  return (
    <div className={`card px-5 py-4 ${highlight ? 'ring-2 ring-forest/20' : ''}`}>
      <p className="text-xs text-stone-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${green ? 'text-forest' : 'text-stone-800'}`}>{value}</p>
    </div>
  )
}
