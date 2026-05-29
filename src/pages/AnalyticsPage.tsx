import { useState, useEffect, useMemo } from 'react'
import { reportePeriodo } from '../api/ventas'
import type { ResumenPeriodo, ResumenDia } from '../types/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import Spinner from '../components/Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

type Rango = 'hoy' | 'semana' | 'mes' | 'anio' | 'custom'

function hoy() { return new Date().toISOString().split('T')[0] }

function rangoFechas(r: Rango): { desde: string; hasta: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  switch (r) {
    case 'hoy':
      return { desde: hoy(), hasta: hoy() }
    case 'semana': {
      const lunes = new Date(now)
      lunes.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      return { desde: fmt(lunes), hasta: hoy() }
    }
    case 'mes': {
      const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
      return { desde: fmt(inicio), hasta: hoy() }
    }
    case 'anio': {
      const inicio = new Date(now.getFullYear(), 0, 1)
      return { desde: fmt(inicio), hasta: hoy() }
    }
    default:
      return { desde: hoy(), hasta: hoy() }
  }
}

function agruparPorMes(dias: ResumenDia[]) {
  const map: Record<string, { label: string; ventas: number; ingresos: number; costos: number; utilidad: number }> = {}
  for (const d of dias) {
    const [anio, mes] = d.fecha.split('-')
    const key = `${anio}-${mes}`
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const label = `${meses[parseInt(mes) - 1]} ${anio}`
    if (!map[key]) map[key] = { label, ventas: 0, ingresos: 0, costos: 0, utilidad: 0 }
    map[key].ventas += d.totalVentas
    map[key].ingresos += d.ingresos
    map[key].costos += d.costos
    map[key].utilidad += d.utilidad
  }
  return Object.values(map)
}

function KpiCard({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`card p-4 ${highlight ? 'border-forest/20 bg-forest/5' : ''}`}>
      <p className="text-xs text-stone-400 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-forest' : 'text-stone-800'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function AnalyticsPage() {
  const [rango, setRango] = useState<Rango>('mes')
  const [customDesde, setCustomDesde] = useState(hoy())
  const [customHasta, setCustomHasta] = useState(hoy())
  const [data, setData] = useState<ResumenPeriodo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { desde, hasta } = useMemo(() => {
    if (rango === 'custom') return { desde: customDesde, hasta: customHasta }
    return rangoFechas(rango)
  }, [rango, customDesde, customHasta])

  useEffect(() => {
    setLoading(true)
    setError('')
    reportePeriodo(desde, hasta)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Error al cargar reporte'))
      .finally(() => setLoading(false))
  }, [desde, hasta])

  const esAnio = rango === 'anio'
  const filas = data ? (esAnio ? agruparPorMes(data.porDia) : data.porDia) : []
  const grafica = filas.map(f => ({
    name: esAnio ? (f as ReturnType<typeof agruparPorMes>[0]).label : f.fecha.slice(5),
    ingresos: f.ingresos,
    costos: f.costos,
    utilidad: f.utilidad,
  }))

  const RANGOS: [Rango, string][] = [
    ['hoy', 'Hoy'],
    ['semana', 'Esta semana'],
    ['mes', 'Este mes'],
    ['anio', 'Este año'],
    ['custom', 'Personalizado'],
  ]

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-800">Reportes</h1>
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-muted rounded-xl p-1 gap-1">
            {RANGOS.map(([r, label]) => (
              <button key={r} onClick={() => setRango(r)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  rango === r ? 'bg-white text-forest shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}>
                {label}
              </button>
            ))}
          </div>
          {rango === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)} className="input text-sm" />
              <span className="text-stone-400 text-sm">—</span>
              <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)} className="input text-sm" />
            </div>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {loading && <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-forest" /></div>}

      {!loading && data && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Ventas" value={String(data.totalVentas)} />
            <KpiCard label="Ingresos" value={fmt(data.ingresos)} highlight />
            <KpiCard label="Costos" value={fmt(data.costos)} />
            <KpiCard label="Utilidad neta" value={fmt(data.utilidad)}
              sub={data.ingresos > 0 ? `${((data.utilidad / data.ingresos) * 100).toFixed(1)}% margen` : undefined} />
          </div>

          {data.totalIva > 0 || data.totalComisiones > 0 ? (
            <div className="card px-5 py-3 flex gap-6 flex-wrap text-xs">
              <span className="text-stone-400">Desglose:</span>
              {data.totalIva > 0 && (
                <span className="text-stone-500">IVA: <strong className="text-stone-700">{fmt(data.totalIva)}</strong></span>
              )}
              {data.totalComisiones > 0 && (
                <span className="text-stone-500">Comisiones: <strong className="text-red-500">{fmt(data.totalComisiones)}</strong></span>
              )}
            </div>
          ) : null}

          {/* Gráfica + métodos */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-5 col-span-2">
              <h3 className="text-sm font-semibold text-stone-700 mb-4">
                {esAnio ? 'Ingresos por mes' : 'Ingresos por día'}
              </h3>
              {grafica.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={grafica} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f0" />
                    <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 12 }}
                      formatter={(v) => fmt(v as number)}
                    />
                    <Bar dataKey="ingresos" name="Ingresos" fill="#4d6335" radius={[3,3,0,0]} />
                    <Bar dataKey="costos" name="Costos" fill="#d4e4b8" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-stone-400 text-center py-10">Sin ventas en el período</p>
              )}
            </div>

            <div className="card p-5">
              <h3 className="text-sm font-semibold text-stone-700 mb-4">Métodos de pago</h3>
              <div className="space-y-3">
                {Object.entries(data.ventasPorMetodoPago).length === 0 ? (
                  <p className="text-sm text-stone-400 text-center py-6">Sin datos</p>
                ) : (
                  Object.entries(data.ventasPorMetodoPago)
                    .sort((a, b) => b[1] - a[1])
                    .map(([metodo, count]) => {
                      const total = Object.values(data.ventasPorMetodoPago).reduce((a, b) => a + b, 0)
                      const pct = total > 0 ? (count / total) * 100 : 0
                      return (
                        <div key={metodo}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-stone-600 font-medium">{metodo}</span>
                            <span className="text-stone-400">{count} ({pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-1.5 bg-stone-100 rounded-full">
                            <div className="h-1.5 bg-forest rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          </div>

          {/* Tabla por día / mes */}
          {filas.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100">
                <h3 className="text-sm font-semibold text-stone-700">
                  {esAnio ? 'Detalle por mes' : 'Detalle por día'}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-left">
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase">{esAnio ? 'Mes' : 'Fecha'}</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase text-right">Ventas</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase text-right">Ingresos</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase text-right">Costos</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase text-right">Utilidad</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase text-right">Margen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {filas.map((f, i) => {
                      const label = esAnio
                        ? (f as ReturnType<typeof agruparPorMes>[0]).label
                        : (f as ResumenDia).fecha
                      const margen = f.ingresos > 0 ? (f.utilidad / f.ingresos) * 100 : 0
                      return (
                        <tr key={i} className="hover:bg-surface-muted/50">
                          <td className="px-5 py-2.5 text-stone-700 font-medium">{label}</td>
                          <td className="px-5 py-2.5 text-right text-stone-500">{f.ventas ?? (f as ResumenDia).totalVentas}</td>
                          <td className="px-5 py-2.5 text-right font-medium text-stone-800">{fmt(f.ingresos)}</td>
                          <td className="px-5 py-2.5 text-right text-stone-500">{fmt(f.costos)}</td>
                          <td className="px-5 py-2.5 text-right font-medium text-forest">{fmt(f.utilidad)}</td>
                          <td className="px-5 py-2.5 text-right text-stone-500">{margen.toFixed(1)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top productos */}
          {data.topProductos.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-stone-100">
                <h3 className="text-sm font-semibold text-stone-700">Productos más vendidos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-left">
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase w-8">#</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase">Producto</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase text-right">Unidades</th>
                      <th className="px-5 py-2.5 text-xs font-medium text-stone-400 uppercase text-right">Ingresos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {data.topProductos.map((p, i) => {
                      const maxCant = data.topProductos[0].cantidad
                      const pct = maxCant > 0 ? (p.cantidad / maxCant) * 100 : 0
                      return (
                        <tr key={p.nombre} className="hover:bg-surface-muted/50">
                          <td className="px-5 py-2.5 text-stone-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-2.5">
                            <div>
                              <span className="text-stone-800 font-medium">{p.nombre}</span>
                              <div className="h-1 bg-stone-100 rounded-full mt-1 w-32">
                                <div className="h-1 bg-forest/60 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right text-stone-700 font-medium">{p.cantidad}</td>
                          <td className="px-5 py-2.5 text-right text-forest font-medium">{fmt(p.ingresos)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.totalVentas === 0 && (
            <p className="text-sm text-stone-400 text-center py-8">Sin ventas en el período seleccionado</p>
          )}
        </div>
      )}
    </div>
  )
}
