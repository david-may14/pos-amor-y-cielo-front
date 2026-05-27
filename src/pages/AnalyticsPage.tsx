import { useState, useEffect } from 'react'
import { obtenerResumen, obtenerProductos, obtenerCategorias, obtenerUsuarios, obtenerMetodosPago, obtenerRecibos } from '../api/analytics'
import type { ResumenVentas, ProductoVentas, CategoriaVentas, UsuarioVentas, MetodoPagoVentas, Recibos } from '../api/analytics'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Cell } from 'recharts'
import Spinner from '../components/Spinner'

type Tab = 'resumen' | 'productos' | 'categorias' | 'usuarios' | 'metodos' | 'recibos'

const COLORES = ['#4d6335', '#7a9d4d', '#a8c68f', '#d4e4b8', '#e8f0d8']

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [desde, setDesde] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
  const [hasta, setHasta] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [resumen, setResumen] = useState<ResumenVentas | null>(null)
  const [productos, setProductos] = useState<ProductoVentas | null>(null)
  const [categorias, setCategorias] = useState<CategoriaVentas | null>(null)
  const [usuarios, setUsuarios] = useState<UsuarioVentas | null>(null)
  const [metodos, setMetodos] = useState<MetodoPagoVentas | null>(null)
  const [recibos, setRecibos] = useState<Recibos | null>(null)

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      switch (tab) {
        case 'resumen':
          setResumen(await obtenerResumen(desde, hasta))
          break
        case 'productos':
          setProductos(await obtenerProductos(desde, hasta))
          break
        case 'categorias':
          setCategorias(await obtenerCategorias(desde, hasta))
          break
        case 'usuarios':
          setUsuarios(await obtenerUsuarios(desde, hasta))
          break
        case 'metodos':
          setMetodos(await obtenerMetodosPago(desde, hasta))
          break
        case 'recibos':
          setRecibos(await obtenerRecibos(desde, hasta))
          break
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [tab, desde, hasta])

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-stone-800">Analytics</h1>
        <div className="flex gap-3">
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="input text-sm" />
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="input text-sm" />
        </div>
      </div>

      <div className="flex gap-1 bg-surface-muted rounded-xl p-1 w-fit mb-6">
        {([['resumen', 'Resumen'], ['productos', 'Productos'], ['categorias', 'Categorías'], ['usuarios', 'Empleados'], ['metodos', 'Métodos de pago'], ['recibos', 'Recibos']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t ? 'bg-white text-forest shadow-sm' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {loading && <div className="flex justify-center py-12"><Spinner className="w-8 h-8 text-forest" /></div>}

      {/* RESUMEN */}
      {!loading && tab === 'resumen' && resumen && (
        <div className="space-y-5">
          <div className="grid grid-cols-5 gap-4">
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Ventas brutas</p>
              <p className="text-2xl font-bold text-stone-800 mt-2">{fmt(resumen.kpis.ventasBrutas)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Reembolsos</p>
              <p className="text-2xl font-bold text-stone-800 mt-2">{fmt(resumen.kpis.reembolsos)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Descuentos</p>
              <p className="text-2xl font-bold text-amber-600 mt-2">{fmt(resumen.kpis.descuentos)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Ventas netas</p>
              <p className="text-2xl font-bold text-forest mt-2">{fmt(resumen.kpis.ventasNetas)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Beneficio bruto</p>
              <p className="text-2xl font-bold text-green-600 mt-2">{fmt(resumen.kpis.beneficioBruto)}</p>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-stone-800 mb-4">Tendencia de ventas</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={resumen.datos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f0" />
                <XAxis dataKey="fecha" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  formatter={(value) => fmt(value as number)}
                />
                <Legend />
                <Line type="monotone" dataKey="ventasBrutas" stroke="#4d6335" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-stone-800 mb-4">Detalles diarios</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Ventas brutas</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Descuentos</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Ventas netas</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Beneficio</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Transacciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {resumen.datos.map((d) => (
                    <tr key={d.fecha} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 text-stone-700">{d.fecha}</td>
                      <td className="px-4 py-3 text-right font-medium text-stone-700">{fmt(d.ventasBrutas)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{fmt(d.descuentos)}</td>
                      <td className="px-4 py-3 text-right text-forest font-medium">{fmt(d.ventasNetas)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt(d.beneficioBruto)}</td>
                      <td className="px-4 py-3 text-right text-stone-500">{d.transacciones}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PRODUCTOS */}
      {!loading && tab === 'productos' && productos && (
        <div className="space-y-5">
          <div className="card p-6">
            <h3 className="font-semibold text-stone-800 mb-4">Top 5 productos</h3>
            <div className="grid grid-cols-5 gap-4 mb-6">
              {productos.top5.map((p) => (
                <div key={p.id} className="bg-surface-muted p-3 rounded-lg">
                  <p className="text-sm font-medium text-stone-800">{p.nombre}</p>
                  <p className="text-xs text-stone-400 mt-1">{p.cantidad} unidades</p>
                  <p className="text-lg font-bold text-forest mt-2">{fmt(p.ventasNetas)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-stone-800 mb-4">Ventas por producto</h3>
            {(() => {
              const datosTransformados = productos.datos.map((d) => {
                const obj: any = { fecha: d.fecha }
                d.productos.forEach((p) => {
                  obj[`prod_${p.productoId}`] = p.cantidad
                })
                return obj
              })
              return (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={datosTransformados}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f0" />
                    <XAxis dataKey="fecha" stroke="#9ca3af" />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Legend />
                    {productos.top5.map((p, idx) => (
                      <Bar
                        key={p.id}
                        dataKey={`prod_${p.id}`}
                        stackId="a"
                        fill={COLORES[idx]}
                        name={p.nombre}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )
            })()}
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-stone-800 mb-4">Detalle de productos</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Producto</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Cantidad</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Ventas netas</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Costo</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Beneficio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {productos.top5.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-medium text-stone-800">{p.nombre}</td>
                      <td className="px-4 py-3 text-right text-stone-700">{p.cantidad}</td>
                      <td className="px-4 py-3 text-right text-forest font-medium">{fmt(p.ventasNetas)}</td>
                      <td className="px-4 py-3 text-right text-stone-500">{fmt(p.costoTotal)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt(p.beneficioBruto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORÍAS */}
      {!loading && tab === 'categorias' && categorias && (
        <div className="card p-6">
          <h3 className="font-semibold text-stone-800 mb-4">Ventas por categoría</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Artículos vendidos</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Ventas netas</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Costo total</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Beneficio bruto</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {categorias.datos.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-medium text-stone-800">{c.nombre}</td>
                    <td className="px-4 py-3 text-right text-stone-700">{c.articulosVendidos}</td>
                    <td className="px-4 py-3 text-right text-forest font-medium">{fmt(c.ventasNetas)}</td>
                    <td className="px-4 py-3 text-right text-stone-500">{fmt(c.costoTotal)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(c.beneficioBruto)}</td>
                    <td className="px-4 py-3 text-right font-medium text-forest">{c.margen.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* USUARIOS */}
      {!loading && tab === 'usuarios' && usuarios && (
        <div className="card p-6">
          <h3 className="font-semibold text-stone-800 mb-4">Ventas por empleado</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Empleado</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Ventas brutas</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Descuentos</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Ventas netas</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Recibos</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Promedio por venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {usuarios.datos.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-medium text-stone-800">{u.nombre}</td>
                    <td className="px-4 py-3 text-right text-stone-700">{fmt(u.ventasBrutas)}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{fmt(u.descuentos)}</td>
                    <td className="px-4 py-3 text-right text-forest font-medium">{fmt(u.ventasNetas)}</td>
                    <td className="px-4 py-3 text-right text-stone-500">{u.recibos}</td>
                    <td className="px-4 py-3 text-right text-green-600">{fmt(u.ventaPromedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MÉTODOS DE PAGO */}
      {!loading && tab === 'metodos' && metodos && (
        <div className="card p-6">
          <h3 className="font-semibold text-stone-800 mb-4">Ventas por método de pago</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Tipo de pago</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Transacciones</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Importe</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Reembolsos</th>
                  <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Monto neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {metodos.datos.map((m, idx) => (
                  <tr key={idx} className="hover:bg-surface-muted/50">
                    <td className="px-4 py-3 font-medium text-stone-800">{m.tipo}</td>
                    <td className="px-4 py-3 text-right text-stone-700">{m.transacciones}</td>
                    <td className="px-4 py-3 text-right text-stone-700">{fmt(m.importe)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{fmt(m.reembolsos)}</td>
                    <td className="px-4 py-3 text-right text-forest font-medium">{fmt(m.montoNeto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* RECIBOS */}
      {!loading && tab === 'recibos' && recibos && (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Total recibos</p>
              <p className="text-3xl font-bold text-stone-800 mt-2">{recibos.resumen.totalRecibos}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Ventas</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{recibos.resumen.ventas}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-stone-400 font-medium uppercase">Reembolsos</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{recibos.resumen.reembolsos}</p>
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-stone-800 mb-4">Historial de transacciones</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-100 text-left">
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">N° Recibo</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Fecha</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Empleado</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-xs font-medium text-stone-400 uppercase text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {recibos.recibos.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-muted/50">
                      <td className="px-4 py-3 font-mono text-stone-700">{r.id}</td>
                      <td className="px-4 py-3 text-stone-500 text-xs">
                        {new Date(r.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-stone-700">{r.empleado}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-md ${
                          r.tipo === 'Venta' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {r.tipo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-stone-700">{fmt(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
