import { useState, useEffect, useCallback } from 'react'
import { listarVentas, resumenDia } from '../api/ventas'
import type { VentaResponse, ResumenDia } from '../types/api'
import Spinner from '../components/Spinner'
import Modal from '../components/Modal'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const hoy = () => new Date().toISOString().split('T')[0]

export default function VentasPage() {
  const [fecha, setFecha] = useState(hoy())
  const [ventas, setVentas] = useState<VentaResponse[]>([])
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detalle, setDetalle] = useState<VentaResponse | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [v, r] = await Promise.all([listarVentas(fecha), resumenDia(fecha)])
      setVentas(v)
      setResumen(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [fecha])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-800">Ventas</h1>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="input w-auto text-sm"
        />
      </div>

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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <ResumenCard label="Ventas" value={String(resumen.totalVentas)} />
              <ResumenCard label="Ingresos" value={fmt(resumen.ingresos)} highlight />
              <ResumenCard label="Costos" value={fmt(resumen.costos)} />
              <ResumenCard label="Utilidad" value={fmt(resumen.utilidad)} green />
            </div>
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

          {/* Tabla de ventas */}
          {ventas.length === 0 ? (
            <div className="card px-6 py-16 text-center text-stone-400 text-sm">
              No hay ventas registradas para esta fecha.
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide"># Venta</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Hora</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Items</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide">Método</th>
                    <th className="px-5 py-3 text-xs font-medium text-stone-400 uppercase tracking-wide text-right">Total</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {ventas.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-muted/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-stone-700">#{v.id}</td>
                      <td className="px-5 py-3 text-stone-500">
                        {new Date(v.creadaEn).toLocaleTimeString('es-MX', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-3 text-stone-500">{v.items.length}</td>
                      <td className="px-5 py-3">
                        <span className="inline-block bg-surface-muted text-stone-600 text-xs px-2 py-0.5 rounded-md">
                          {v.metodoPago}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-stone-800">
                        {fmt(v.total)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => setDetalle(v)}
                          className="text-xs text-forest hover:underline"
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Detalle modal */}
      {detalle && (
        <Modal title={`Venta #${detalle.id}`} onClose={() => setDetalle(null)} size="sm">
          <div className="space-y-3">
            <div className="flex justify-between text-sm text-stone-500">
              <span>{new Date(detalle.creadaEn).toLocaleString('es-MX')}</span>
              <span className="font-medium">{detalle.metodoPago}</span>
            </div>
            <div className="space-y-2 border-t border-stone-100 pt-3">
              {detalle.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-stone-600">
                    {item.cantidad}× {item.nombreProducto}
                    {item.notas && (
                      <span className="text-stone-400 italic"> — {item.notas}</span>
                    )}
                  </span>
                  <span className="font-medium">{fmt(item.precioUnitario * item.cantidad)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-100 pt-3 space-y-1">
              <div className="flex justify-between text-sm text-stone-500">
                <span>Costo</span>
                <span>{fmt(detalle.costoTotal)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-forest text-lg">{fmt(detalle.total)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
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
