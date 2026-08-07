import {
  LineChart, Line, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell,
} from 'recharts'
import type { CosteoDTO } from '../types/api'

/**
 * Las dos gráficas del costeo de un producto. Viven aquí y no dentro de
 * CosteoPage porque el reporte imprimible dibuja exactamente las mismas: si se
 * duplicaran, el PDF que alguien comparte acabaría enseñando otra cosa que la
 * pantalla.
 *
 * Recharts pinta SVG, así que al imprimir salen vectoriales y se ven nítidas a
 * cualquier zoom — es lo que hace viable generar el PDF desde el navegador sin
 * meter ninguna librería de PDF.
 */

const COLORES_ING = ['#4d6335', '#7a9d4d', '#a8c68f', '#f97316', '#fb923c', '#fbbf24', '#60a5fa', '#a78bfa']

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const TOOLTIP = {
  backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: 11,
}

export function GraficaDesglose({ detalle }: { detalle: CosteoDTO }) {
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
          <Pie data={lineas} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={36}
               isAnimationActive={false}>
            {lineas.map((_, i) => <Cell key={i} fill={COLORES_ING[i % COLORES_ING.length]} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP} formatter={(v) => fmt(Number(v ?? 0))} />
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

interface HistorialProps {
  historial: CosteoDTO['historial']
  /**
   * Ancho fijo en px. Al imprimir hay que darlo: ResponsiveContainer mide el
   * contenedor con ResizeObserver, y en el render de impresión esa medida puede
   * llegar en cero y dejar la gráfica en blanco justo en el PDF.
   */
  ancho?: number
}

export function GraficaHistorial({ historial, ancho }: HistorialProps) {
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
    <ResponsiveContainer width={ancho ?? '100%'} height={180}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f0" />
        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" tickFormatter={v => `$${v}`} />
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => fmt(Number(v ?? 0))} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="costo" name="Costo" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }}
              isAnimationActive={false} />
        <Line type="monotone" dataKey="precio" name="Precio" stroke="#4d6335" strokeWidth={2} dot={{ r: 3 }}
              strokeDasharray="4 2" isAnimationActive={false} />
        <Line type="monotone" dataKey="margen" name="Margen" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }}
              isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
