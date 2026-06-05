import { useState, useEffect, useMemo } from 'react'
import { listarCosteo, detalleCosteo, actualizarMargenSeguridad, actualizarPrecioProducto } from '../api/productos'
import { obtenerConfiguracion } from '../api/configuracion'
import type { CosteoDTO } from '../types/api'
import Spinner from '../components/Spinner'
import { LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
const fmtU = (n: number) =>
  new Intl.NumberFormat('es-MX', { minimumFractionDigits: 4, maximumFractionDigits: 4 }).format(n)

function MargenBadge({ pct }: { pct: number }) {
  const color = pct >= 60 ? 'text-green-600' : pct >= 40 ? 'text-amber-600' : 'text-red-500'
  return <span className={`font-semibold ${color}`}>{pct.toFixed(1)}%</span>
}

// Umbrales estándar para café: < 30% excelente, 30-35% bueno, 35-45% alerta, > 45% crítico
function FoodCostBadge({ pct }: { pct: number }) {
  const color = pct < 30 ? 'text-green-600' : pct < 35 ? 'text-amber-500' : pct < 45 ? 'text-orange-500' : 'text-red-600'
  return <span className={`font-semibold ${color}`}>{pct.toFixed(1)}%</span>
}

const COLORES_ING = ['#4d6335', '#7a9d4d', '#a8c68f', '#f97316', '#fb923c', '#fbbf24', '#60a5fa', '#a78bfa']

function GraficaDesglose({ detalle }: { detalle: CosteoDTO }) {
  const lineas = [
    ...detalle.ingredientesDirectos.map(l => ({ name: l.nombre, value: Number(l.costoLinea) })),
    ...detalle.plantillas.flatMap(pl => pl.ingredientes.map(l => ({ name: l.nombre, value: Number(l.costoLinea) }))),
  ].filter(l => l.value > 0).sort((a, b) => b.value - a.value)

  if (lineas.length === 0) return (
    <p className="text-xs text-stone-400 italic">Sin ingredientes — asigna una receta primero</p>
  )

  return (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie data={lineas} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={36}>
            {lineas.map((_, i) => <Cell key={i} fill={COLORES_ING[i % COLORES_ING.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 11 }}
            formatter={(v: number) => fmt(v)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5">
        {lineas.map((l, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORES_ING[i % COLORES_ING.length] }} />
            <span className="text-stone-600 flex-1 truncate">{l.name}</span>
            <span className="text-stone-700 font-medium shrink-0">{fmt(l.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function GraficaHistorial({ historial }: { historial: CosteoDTO['historial'] }) {
  if (historial.length === 0) return (
    <p className="text-xs text-stone-400 italic">Guarda la receta para registrar el primer punto del historial</p>
  )
  const data = [...historial].reverse().map(h => ({
    fecha: h.fecha.slice(5),
    costo: Number(h.costoTotal.toFixed(2)),
    precio: Number(h.precioVenta.toFixed(2)),
    margen: Number((h.precioVenta - h.costoTotal).toFixed(2)),
  }))
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f0" />
        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => `$${v}`} />
        <Tooltip
          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 11 }}
          formatter={(v: number) => fmt(v)}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="costo" name="Costo" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="precio" name="Precio" stroke="#4d6335" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="margen" name="Margen" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function CosteoPage() {
  const [productos, setProductos] = useState<CosteoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandido, setExpandido] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<Record<number, CosteoDTO>>({})
  const [loadingDetalle, setLoadingDetalle] = useState<number | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [sortCol, setSortCol] = useState<string>('nombre')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }
  const [editandoMargen, setEditandoMargen] = useState<Record<number, string>>({})
  const [guardandoMargen, setGuardandoMargen] = useState<number | null>(null)
  const [errorMargen, setErrorMargen] = useState<Record<number, string>>({})
  const [editandoPrecio, setEditandoPrecio] = useState<Record<number, boolean>>({})
  const [margenParaPrecio, setMargenParaPrecio] = useState<Record<string, string>>({})
  const [guardandoPrecio, setGuardandoPrecio] = useState<number | null>(null)
  const [errorPrecio, setErrorPrecio] = useState<Record<number, string>>({})
  const [iva, setIva] = useState(0)
  const [soloSinReceta, setSoloSinReceta] = useState(false)

  // costoBase = costoConMargen si existe, si no costoTotal
  const costoBase = (p: CosteoDTO) => p.costoConMargen ?? p.costoTotal

  const margenRealPct = (precioVenta: number, base: number) => {
    if (base <= 0 || precioVenta <= 0) return null
    const neto = iva > 0 ? precioVenta / (1 + iva / 100) : precioVenta
    return (neto - base) / neto * 100
  }

  const margenRealAbs = (precioVenta: number, base: number) => {
    if (base <= 0 || precioVenta <= 0) return null
    const neto = iva > 0 ? precioVenta / (1 + iva / 100) : precioVenta
    return neto - base
  }

  const foodCostPct = (precioVenta: number, base: number) => {
    if (base <= 0 || precioVenta <= 0) return null
    const neto = iva > 0 ? precioVenta / (1 + iva / 100) : precioVenta
    return base / neto * 100
  }

  const categorias = useMemo(() => {
    const cats = [...new Set(productos.map(p => p.categoria ?? '').filter(Boolean))].sort()
    return ['Todos', ...cats]
  }, [productos])

  useEffect(() => {
    Promise.all([listarCosteo(), obtenerConfiguracion()])
      .then(([prods, config]) => { setProductos(prods); setIva(config.ivaPorcentaje) })
      .catch(() => setError('Error al cargar costeo'))
      .finally(() => setLoading(false))
  }, [])

  const handleExpandir = async (id: number) => {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    if (!detalle[id]) {
      setLoadingDetalle(id)
      try {
        const d = await detalleCosteo(id)
        setDetalle(prev => ({ ...prev, [id]: d }))
      } finally {
        setLoadingDetalle(null)
      }
    }
  }

  const aplicarActualizacionMargen = async (productoId: number, valor: number | null) => {
    setGuardandoMargen(productoId)
    setErrorMargen(prev => { const n = { ...prev }; delete n[productoId]; return n })
    try {
      await actualizarMargenSeguridad(productoId, valor)
      const d = await detalleCosteo(productoId)
      setDetalle(prev => ({ ...prev, [productoId]: d }))
      setProductos(prev => prev.map(p => p.productoId === productoId ? { ...p, ...d } : p))
      setEditandoMargen(prev => { const n = { ...prev }; delete n[productoId]; return n })
    } catch (e: unknown) {
      setErrorMargen(prev => ({ ...prev, [productoId]: e instanceof Error ? e.message : 'Error al guardar' }))
    } finally {
      setGuardandoMargen(null)
    }
  }

  const handleGuardarMargen = (productoId: number) => {
    const raw = editandoMargen[productoId]
    const valor = raw === '' ? null : parseFloat(raw)
    if (valor !== null && (isNaN(valor) || valor < 0 || valor >= 100)) return
    aplicarActualizacionMargen(productoId, valor)
  }

  const handleLimpiarMargen = (productoId: number) => {
    aplicarActualizacionMargen(productoId, null)
  }

  // precioConIVA = (costoTotal / (1 - margen%)) * (1 + iva%)
  const calcPrecioDesdeMargen = (costoTotal: number, margenPct: number): number | null => {
    if (costoTotal <= 0 || margenPct <= 0 || margenPct >= 100) return null
    const precioNeto = costoTotal / (1 - margenPct / 100)
    return Math.round(precioNeto * (1 + iva / 100) * 100) / 100
  }

  const guardarPrecio = async (productoId: number, precio: number) => {
    setGuardandoPrecio(productoId)
    setErrorPrecio(prev => { const n = { ...prev }; delete n[productoId]; return n })
    try {
      await actualizarPrecioProducto(productoId, precio)
      const d = await detalleCosteo(productoId)
      setDetalle(prev => ({ ...prev, [productoId]: d }))
      setProductos(prev => prev.map(p => p.productoId === productoId ? { ...p, ...d } : p))
      setEditandoPrecio(prev => { const n = { ...prev }; delete n[productoId]; return n })
      setMargenParaPrecio(prev => {
        const n = { ...prev }
        delete n[productoId]
        delete n[`precio_${productoId}`]
        return n
      })
    } catch (e: unknown) {
      setErrorPrecio(prev => ({ ...prev, [productoId]: e instanceof Error ? e.message : 'Error al guardar' }))
    } finally {
      setGuardandoPrecio(null)
    }
  }

  const handleGuardarPrecio = (productoId: number) => {
    const d = detalle[productoId]
    const base = d ? costoBase(d) : 0
    const precio = calcPrecioDesdeMargen(base, parseFloat(margenParaPrecio[productoId] ?? ''))
    if (!precio) return
    guardarPrecio(productoId, precio)
  }

  const handleGuardarPrecioDirecto = (productoId: number, precio: number) => {
    if (isNaN(precio) || precio <= 0) return
    guardarPrecio(productoId, precio)
  }

  const sinReceta = (p: CosteoDTO) => p.costoTotal === 0 && p.ingredientesDirectos.length === 0 && p.plantillas.length === 0
  const sinRecetaCount = productos.filter(sinReceta).length

  const filtrados = productos
    .filter(p =>
      (categoria === 'Todos' || p.categoria === categoria) &&
      (p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.categoria ?? '').toLowerCase().includes(busqueda.toLowerCase())) &&
      (!soloSinReceta || sinReceta(p))
    )
    .sort((a, b) => {
      let diff = 0
      switch (sortCol) {
        case 'categoria':  diff = (a.categoria ?? '').localeCompare(b.categoria ?? ''); break
        case 'costo':      diff = a.costoTotal - b.costoTotal; break
        case 'precio':     diff = a.precioVenta - b.precioVenta; break
        case 'foodcost':   diff = (foodCostPct(a.precioVenta, costoBase(a)) ?? -999) - (foodCostPct(b.precioVenta, costoBase(b)) ?? -999); break
        case 'margenabs':  diff = (margenRealAbs(a.precioVenta, costoBase(a)) ?? -999) - (margenRealAbs(b.precioVenta, costoBase(b)) ?? -999); break
        case 'margenpct':  diff = (margenRealPct(a.precioVenta, costoBase(a)) ?? -999) - (margenRealPct(b.precioVenta, costoBase(b)) ?? -999); break
        default:           diff = a.nombre.localeCompare(b.nombre)
      }
      return sortDir === 'asc' ? diff : -diff
    })

  const exportarCSV = () => {
    const fmtN = (n: number | null | undefined) => n != null ? n.toFixed(4) : ''
    const headers = ['Producto','Categoría','Costo real','Costo con margen','Precio','Food cost %','Margen % neto','Margen $ neto']
    const rows = productos.map(p => {
      const base = costoBase(p)
      const fc = foodCostPct(p.precioVenta, base)
      const mp = margenRealPct(p.precioVenta, base)
      const ma = margenRealAbs(p.precioVenta, base)
      return [
        `"${p.nombre}"`,
        `"${p.categoria ?? ''}"`,
        fmtN(p.costoTotal),
        fmtN(p.costoConMargen),
        fmtN(p.precioVenta),
        fc != null ? fc.toFixed(2) : '',
        mp != null ? mp.toFixed(2) : '',
        ma != null ? ma.toFixed(4) : '',
      ].join(',')
    })
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `costeo-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner className="w-8 h-8 text-forest" />
    </div>
  )

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Costeo de productos</h1>
          <p className="text-sm text-stone-400 mt-0.5">Desglose de costo por ingrediente, margen y tendencia</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input text-sm w-44"
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          <button
            onClick={exportarCSV}
            className="btn-secondary flex items-center gap-1.5 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5 0-4.5 4.5M12 3v13.5m4.5-4.5L12 16.5" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categorias.map(c => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              categoria === c
                ? 'bg-forest text-cream'
                : 'bg-white border border-stone-200 text-stone-600 hover:border-forest/50 hover:text-forest'
            }`}
          >
            {c === 'Todos' ? 'Todas' : c}
          </button>
        ))}
        {sinRecetaCount > 0 && (
          <button
            onClick={() => setSoloSinReceta(v => !v)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              soloSinReceta
                ? 'bg-amber-500 text-white'
                : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            Sin receta ({sinRecetaCount})
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 text-left border-b border-stone-100">
              <th className="px-5 py-3 w-8"></th>
              {([
                { col: 'nombre',    label: 'Producto',      right: false },
                { col: 'categoria', label: 'Categoría',     right: false },
                { col: 'costo',     label: 'Costo',         right: true  },
                { col: 'precio',    label: 'Precio',        right: true  },
                { col: 'foodcost',  label: 'Food cost %',   right: true  },
                { col: 'margenabs', label: 'Margen $ neto', right: true  },
                { col: 'margenpct', label: 'Margen % neto', right: true  },
              ] as const).map(({ col, label, right }) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={`px-5 py-3 text-xs font-medium uppercase tracking-wide cursor-pointer select-none
                    ${sortCol === col ? 'text-forest' : 'text-stone-400 hover:text-stone-600'}
                    ${right ? 'text-right' : ''}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <span className="text-[10px]">
                      {sortCol === col ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <>
                <tr
                  key={p.productoId}
                  onClick={() => handleExpandir(p.productoId)}
                  className={`border-b border-stone-50 cursor-pointer hover:bg-surface-muted/50 transition-colors ${expandido === p.productoId ? 'bg-surface-muted/50' : ''}`}
                >
                  <td className="px-5 py-3 text-stone-400">
                    {loadingDetalle === p.productoId
                      ? <Spinner className="w-3.5 h-3.5 text-forest" />
                      : <svg className={`w-3.5 h-3.5 transition-transform ${expandido === p.productoId ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
                        </svg>
                    }
                  </td>
                  <td className="px-5 py-3 font-medium text-stone-800">
                    <div className="flex items-center gap-2">
                      {p.nombre}
                      {sinReceta(p) && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">sin receta</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-stone-500">{p.categoria || '—'}</td>
                  <td className="px-5 py-3 text-right text-stone-600">{p.costoTotal > 0 ? fmt(p.costoTotal) : <span className="text-stone-300 italic text-xs">—</span>}</td>
                  <td className="px-5 py-3 text-right font-semibold text-forest">{fmt(p.precioVenta)}</td>
                  <td className="px-5 py-3 text-right">
                    {foodCostPct(p.precioVenta, costoBase(p)) != null ? <FoodCostBadge pct={foodCostPct(p.precioVenta, costoBase(p))!} /> : '—'}
                  </td>
                  <td className="px-5 py-3 text-right text-stone-600">
                    {margenRealAbs(p.precioVenta, costoBase(p)) != null ? fmt(margenRealAbs(p.precioVenta, costoBase(p))!) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {margenRealPct(p.precioVenta, costoBase(p)) != null ? <MargenBadge pct={margenRealPct(p.precioVenta, costoBase(p))!} /> : '—'}
                  </td>
                </tr>

                {expandido === p.productoId && detalle[p.productoId] && (
                  <tr key={`${p.productoId}-det`} className="bg-stone-50/50">
                    <td colSpan={8} className="px-6 py-4 bg-stone-50/50">
                      <div className="grid grid-cols-2 gap-8">

                        {/* Tabla de ingredientes */}
                        <div>
                          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Desglose de ingredientes</p>
                          {detalle[p.productoId].ingredientesDirectos.length === 0 && detalle[p.productoId].plantillas.length === 0 ? (
                            <p className="text-xs text-stone-400 italic">Sin receta asignada</p>
                          ) : (
                            <div className="space-y-3">
                              {detalle[p.productoId].ingredientesDirectos.length > 0 && (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-stone-400">
                                      <th className="text-left pb-1">Ingrediente</th>
                                      <th className="text-right pb-1">Cant.</th>
                                      <th className="text-right pb-1">Costo/u</th>
                                      <th className="text-right pb-1">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-stone-100">
                                    {detalle[p.productoId].ingredientesDirectos.map((l, i) => (
                                      <tr key={i}>
                                        <td className="py-1 text-stone-700">
                                          {l.nombre}
                                          {l.mermaPorcentaje > 0 && <span className="ml-1 text-amber-500 text-[10px]">+{l.mermaPorcentaje}%</span>}
                                        </td>
                                        <td className="py-1 text-right text-stone-500">{l.cantidad} {l.unidad}</td>
                                        <td className="py-1 text-right text-stone-400">{fmtU(l.costoUnitario)}</td>
                                        <td className="py-1 text-right font-medium text-stone-700">{fmt(l.costoLinea)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {detalle[p.productoId].plantillas.map((pl, pi) => (
                                <div key={pi}>
                                  <p className="text-[10px] font-medium text-forest/70 mb-1 uppercase">{pl.nombre}</p>
                                  <table className="w-full text-xs">
                                    <tbody className="divide-y divide-stone-100">
                                      {pl.ingredientes.map((l, i) => (
                                        <tr key={i}>
                                          <td className="py-1 text-stone-600">
                                            {l.nombre}
                                            {l.mermaPorcentaje > 0 && <span className="ml-1 text-amber-500 text-[10px]">+{l.mermaPorcentaje}%</span>}
                                          </td>
                                          <td className="py-1 text-right text-stone-400">{l.cantidad} {l.unidad}</td>
                                          <td className="py-1 text-right text-stone-400">{fmtU(l.costoUnitario)}</td>
                                          <td className="py-1 text-right font-medium text-stone-600">{fmt(l.costoLinea)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ))}
                              <div className="flex justify-between pt-1 border-t border-stone-200 text-xs font-semibold">
                                <span className="text-stone-600">Costo real</span>
                                <span className="text-stone-800">{fmt(detalle[p.productoId].costoTotal)}</span>
                              </div>

                              {/* Margen de seguridad */}
                              <div className="flex items-center gap-2 pt-0.5 text-xs">
                                <span className="text-stone-500 shrink-0">Margen de seguridad:</span>
                                {editandoMargen[p.productoId] !== undefined ? (
                                  <>
                                    <div className="relative">
                                      <input
                                        className="input py-0.5 pr-6 text-xs w-20"
                                        type="number" min="0" max="99" step="0.5"
                                        autoFocus
                                        value={editandoMargen[p.productoId]}
                                        onChange={e => setEditandoMargen(prev => ({ ...prev, [p.productoId]: e.target.value }))}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') handleGuardarMargen(p.productoId)
                                          if (e.key === 'Escape') setEditandoMargen(prev => { const n = { ...prev }; delete n[p.productoId]; return n })
                                        }}
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">%</span>
                                    </div>
                                    <button onClick={() => handleGuardarMargen(p.productoId)} disabled={guardandoMargen === p.productoId} className="text-forest hover:underline font-medium disabled:opacity-50">
                                      {guardandoMargen === p.productoId ? 'Guardando…' : 'Guardar'}
                                    </button>
                                    <button onClick={() => setEditandoMargen(prev => { const n = { ...prev }; delete n[p.productoId]; return n })} className="text-stone-400 hover:text-stone-600">Cancelar</button>
                                    {errorMargen[p.productoId] && <span className="text-red-500">{errorMargen[p.productoId]}</span>}
                                  </>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => setEditandoMargen(prev => ({ ...prev, [p.productoId]: detalle[p.productoId].margenSeguridad != null ? String(detalle[p.productoId].margenSeguridad) : '' }))} className="flex items-center gap-1 text-stone-400 hover:text-forest">
                                      <span className="font-medium text-stone-600">{detalle[p.productoId].margenSeguridad != null ? `${detalle[p.productoId].margenSeguridad}%` : 'Sin margen'}</span>
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                                    </button>
                                    {detalle[p.productoId].margenSeguridad != null && (
                                      <button
                                        onClick={() => handleLimpiarMargen(p.productoId)}
                                        disabled={guardandoMargen === p.productoId}
                                        title="Quitar margen de seguridad"
                                        className="text-stone-300 hover:text-red-400 disabled:opacity-40 leading-none"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {detalle[p.productoId].costoConMargen != null && (
                                <div className="flex justify-between text-xs">
                                  <span className="text-blue-600">Costo con margen</span>
                                  <span className="text-blue-700 font-semibold">{fmt(detalle[p.productoId].costoConMargen!)}</span>
                                </div>
                              )}

                              {/* Precio de venta */}
                              {(() => {
                                const d = detalle[p.productoId]
                                const base = costoBase(d)
                                const usandoMargenSeg = d.costoConMargen != null
                                const precioSinIVA = iva > 0 ? d.precioVenta / (1 + iva / 100) : d.precioVenta
                                const margenReal = precioSinIVA > 0 && base > 0
                                  ? ((precioSinIVA - base) / precioSinIVA * 100)
                                  : null
                                const margenInput = margenParaPrecio[p.productoId] ?? ''
                                const precioCalc = margenInput ? calcPrecioDesdeMargen(base, parseFloat(margenInput)) : null
                                const editando = !!editandoPrecio[p.productoId]
                                return (
                                  <div className="mt-2 pt-2 border-t border-stone-200 space-y-1.5">
                                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Precio de venta</p>

                                    <div className="flex items-center justify-between text-xs">
                                      <span className="text-stone-500">Precio actual{iva > 0 ? ` (con IVA ${iva}%)` : ''}</span>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-semibold text-forest">{fmt(d.precioVenta)}</span>
                                        {!editando && d.costoTotal > 0 && (
                                          <button onClick={() => setEditandoPrecio(prev => ({ ...prev, [p.productoId]: true }))} className="text-stone-400 hover:text-forest">
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" /></svg>
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {iva > 0 && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-stone-400">Sin IVA</span>
                                        <span className="text-stone-500">{fmt(precioSinIVA)}</span>
                                      </div>
                                    )}

                                    {margenReal !== null && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-stone-400">Food cost</span>
                                        <FoodCostBadge pct={100 - margenReal} />
                                      </div>
                                    )}
                                    {margenReal !== null && (
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-stone-400">Margen actual (sobre neto)</span>
                                        <MargenBadge pct={margenReal} />
                                      </div>
                                    )}

                                    {usandoMargenSeg && base > 0 && (
                                      <p className="text-[10px] text-blue-500">
                                        Base de cálculo: costo con margen de seguridad ({fmt(base)})
                                      </p>
                                    )}

                                    {editando && (() => {
                                      const cerrar = () => {
                                        setEditandoPrecio(prev => { const n = { ...prev }; delete n[p.productoId]; return n })
                                        setMargenParaPrecio(prev => { const n = { ...prev }; delete n[p.productoId]; return n })
                                      }
                                      // precio directo → margen resultante
                                      const precioDirecto = parseFloat(margenParaPrecio[`precio_${p.productoId}`] ?? '')
                                      const margenDesdePrecio = !isNaN(precioDirecto) && precioDirecto > 0 && base > 0
                                        ? ((precioDirecto / (1 + iva / 100) - base) / (precioDirecto / (1 + iva / 100)) * 100)
                                        : null
                                      // margen → precio resultante
                                      const margenDeseado = parseFloat(margenInput)
                                      return (
                                        <div className="mt-1.5 pt-1.5 border-t border-stone-100 space-y-2 text-xs">
                                          {/* Opción 1: precio directo */}
                                          <div className="flex items-center gap-2">
                                            <span className="text-stone-400 w-16 shrink-0">Por precio</span>
                                            <div className="relative">
                                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">$</span>
                                              <input
                                                className="input py-0.5 pl-5 text-xs w-24"
                                                type="number" min="0.01" step="0.50"
                                                placeholder={String(d.precioVenta)}
                                                value={margenParaPrecio[`precio_${p.productoId}`] ?? ''}
                                                onChange={e => setMargenParaPrecio(prev => ({ ...prev, [`precio_${p.productoId}`]: e.target.value }))}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter' && !isNaN(precioDirecto) && precioDirecto > 0) handleGuardarPrecioDirecto(p.productoId, precioDirecto)
                                                  if (e.key === 'Escape') cerrar()
                                                }}
                                              />
                                            </div>
                                            {margenDesdePrecio !== null && (
                                              <span className="text-stone-500">→ margen <MargenBadge pct={margenDesdePrecio} /></span>
                                            )}
                                            <button
                                              onClick={() => handleGuardarPrecioDirecto(p.productoId, precioDirecto)}
                                              disabled={isNaN(precioDirecto) || precioDirecto <= 0 || guardandoPrecio === p.productoId}
                                              className="text-forest hover:underline font-medium disabled:opacity-40"
                                            >
                                              Guardar
                                            </button>
                                          </div>

                                          {/* Opción 2: margen → precio */}
                                          <div className="flex items-center gap-2">
                                            <span className="text-stone-400 w-16 shrink-0">Por margen</span>
                                            <div className="relative">
                                              <input
                                                className="input py-0.5 pr-6 text-xs w-20"
                                                type="number" min="1" max="99" step="0.5"
                                                placeholder="Ej. 75"
                                                value={margenInput}
                                                onChange={e => setMargenParaPrecio(prev => ({ ...prev, [p.productoId]: e.target.value }))}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') handleGuardarPrecio(p.productoId)
                                                  if (e.key === 'Escape') cerrar()
                                                }}
                                              />
                                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none">%</span>
                                            </div>
                                            {precioCalc != null && (
                                              <span className="text-stone-500">→ <span className="font-medium text-stone-700">{fmt(precioCalc)}</span>{iva > 0 && <span className="text-stone-400"> (neto {fmt(precioCalc / (1 + iva / 100))})</span>}</span>
                                            )}
                                            <button
                                              onClick={() => handleGuardarPrecio(p.productoId)}
                                              disabled={!precioCalc || guardandoPrecio === p.productoId}
                                              className="text-forest hover:underline font-medium disabled:opacity-40"
                                            >
                                              Guardar
                                            </button>
                                          </div>

                                          <div className="flex items-center gap-3 pt-0.5">
                                            <button onClick={cerrar} className="text-stone-400 hover:text-stone-600">Cancelar</button>
                                            {errorPrecio[p.productoId] && <span className="text-red-500">{errorPrecio[p.productoId]}</span>}
                                          </div>
                                        </div>
                                      )
                                    })()}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>

                        {/* Gráficas apiladas */}
                        <div className="space-y-6">
                          <div>
                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Distribución de costo</p>
                            <GraficaDesglose detalle={detalle[p.productoId]} />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Evolución costo vs precio</p>
                            <GraficaHistorial historial={detalle[p.productoId].historial} />
                          </div>
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}

            {filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-stone-400 text-sm">
                  {busqueda ? 'Sin resultados para la búsqueda' : 'Sin productos'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
