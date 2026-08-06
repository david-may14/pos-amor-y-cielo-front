import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { costeoCompleto } from '../api/productos'
import { obtenerConfiguracion } from '../api/configuracion'
import type { CosteoDTO } from '../types/api'
import { GraficaDesglose, GraficaHistorial } from '../components/GraficasCosteo'
import Spinner from '../components/Spinner'

/**
 * Reporte de costeo para compartir o archivar.
 *
 * El PDF lo genera el propio navegador con window.print(): las gráficas de
 * recharts son SVG, así que salen vectoriales y nítidas sin meter ninguna
 * librería de PDF en un bundle que ya pesa un mega.
 *
 * Vive en su propia ruta y no dentro de CosteoPage porque lo que se imprime es
 * un documento distinto de lo que se opera: sin filtros, sin botones, con
 * portada y con el desglose de todos los productos abierto de una vez.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

/** Ancho fijo para la gráfica de historial: al imprimir el responsive falla. */
const ANCHO_GRAFICA = 640

export default function CosteoReportePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [productos, setProductos] = useState<CosteoDTO[]>([])
  const [iva, setIva] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Se heredan de la tabla para que el reporte cubra lo mismo que estabas
  // mirando; abierto en directo, sin parámetros, sale el catálogo entero.
  const categoria = params.get('categoria') ?? 'Todos'
  const busqueda = (params.get('q') ?? '').toLowerCase()

  useEffect(() => {
    Promise.all([costeoCompleto(), obtenerConfiguracion()])
      .then(([prods, config]) => { setProductos(prods); setIva(config.ivaPorcentaje) })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el costeo'))
      .finally(() => setCargando(false))
  }, [])

  const filtrados = useMemo(() => productos.filter(p =>
    (categoria === 'Todos' || p.categoria === categoria) &&
    (busqueda === '' || p.nombre.toLowerCase().includes(busqueda))
  ), [productos, categoria, busqueda])

  const costoBase = (p: CosteoDTO) => p.costoConMargen ?? p.costoTotal
  const neto = (precio: number) => (iva > 0 ? precio / (1 + iva / 100) : precio)

  const foodCost = (p: CosteoDTO) => {
    const base = costoBase(p)
    const n = neto(p.precioVenta)
    if (base <= 0 || n <= 0) return null
    return (base / n) * 100
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Spinner className="w-8 h-8 text-forest mx-auto" />
          <p className="text-sm text-stone-500 mt-3">Reuniendo el costeo del catálogo…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <p className="text-lg font-medium text-stone-700">No se pudo generar el reporte</p>
          <p className="text-sm text-stone-500 mt-2 break-words">{error}</p>
          <button onClick={() => navigate('/costeo')} className="btn-primary mt-5 px-6 py-2">
            Volver al costeo
          </button>
        </div>
      </div>
    )
  }

  const conPerdida = filtrados.filter(p => { const fc = foodCost(p); return fc !== null && fc > 100 })

  return (
    <div className="reporte min-h-screen bg-white text-stone-800">
      {/* Barra de acciones: no se imprime */}
      <div className="no-print sticky top-0 z-10 bg-surface border-b border-stone-200 px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate('/costeo')} className="text-sm text-stone-600 hover:text-forest">
          ← Volver al costeo
        </button>
        <button onClick={() => window.print()} className="btn-primary px-5 py-2">
          Imprimir o guardar PDF
        </button>
      </div>

      <div className="max-w-[820px] mx-auto px-8 py-8">
        <header className="mb-8 pb-6 border-b border-stone-200">
          <h1 className="text-2xl font-semibold text-forest">Reporte de costeo</h1>
          <p className="text-sm text-stone-500 mt-1">Amor y Cielo · Mérida, Yucatán</p>
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
            <div className="flex justify-between border-b border-stone-100 py-1">
              <dt className="text-stone-500">Generado</dt>
              <dd>{new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' })}</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1">
              <dt className="text-stone-500">Productos</dt>
              <dd>{filtrados.length}</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1">
              <dt className="text-stone-500">Categoría</dt>
              <dd>{categoria}</dd>
            </div>
            <div className="flex justify-between border-b border-stone-100 py-1">
              <dt className="text-stone-500">IVA aplicado</dt>
              <dd>{iva}%</dd>
            </div>
          </dl>

          {conPerdida.length > 0 && (
            // Va en la portada porque es lo que alguien necesita ver primero al
            // recibir el reporte, no enterrado en la página doce.
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-700">
                {conPerdida.length} producto{conPerdida.length === 1 ? '' : 's'} se vende{conPerdida.length === 1 ? '' : 'n'} por debajo de su costo
              </p>
              <p className="text-xs text-red-600 mt-1">
                {conPerdida.map(p => p.nombre).join(' · ')}
              </p>
            </div>
          )}
        </header>

        <section className="mb-10">
          <h2 className="text-base font-semibold mb-3">Resumen</h2>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-stone-300 text-left">
                <th className="py-2 pr-2 font-medium">Producto</th>
                <th className="py-2 px-2 font-medium">Categoría</th>
                <th className="py-2 px-2 font-medium text-right">Costo</th>
                <th className="py-2 px-2 font-medium text-right">Precio</th>
                <th className="py-2 px-2 font-medium text-right">Neto</th>
                <th className="py-2 pl-2 font-medium text-right">Food cost</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map(p => {
                const fc = foodCost(p)
                return (
                  <tr key={p.productoId} className="border-b border-stone-100">
                    <td className="py-1.5 pr-2">{p.nombre}</td>
                    <td className="py-1.5 px-2 text-stone-500">{p.categoria ?? '—'}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(costoBase(p))}</td>
                    <td className="py-1.5 px-2 text-right">{fmt(p.precioVenta)}</td>
                    <td className="py-1.5 px-2 text-right text-stone-500">{fmt(neto(p.precioVenta))}</td>
                    <td className={`py-1.5 pl-2 text-right font-medium ${fc !== null && fc > 100 ? 'text-red-600' : ''}`}>
                      {fc !== null ? `${fc.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-stone-400 mt-2">
            El food cost se calcula sobre el precio neto (sin IVA), que es el estándar de la industria:
            el IVA se cobra en nombre de Hacienda y no es ingreso del negocio.
          </p>
        </section>

        <h2 className="text-base font-semibold mb-4">Detalle por producto</h2>
        {filtrados.map(p => (
          <FichaProducto key={p.productoId} producto={p} costoBase={costoBase(p)}
                         neto={neto(p.precioVenta)} foodCost={foodCost(p)} />
        ))}
      </div>
    </div>
  )
}

interface FichaProps {
  producto: CosteoDTO
  costoBase: number
  neto: number
  foodCost: number | null
}

function FichaProducto({ producto: p, costoBase, neto, foodCost }: FichaProps) {
  return (
    <article className="ficha mb-8 pb-6 border-b border-stone-200 last:border-b-0">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <h3 className="font-semibold">{p.nombre}</h3>
        <span className="text-xs text-stone-500">{p.categoria ?? 'Sin categoría'}</span>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4 text-xs">
        <Cifra etiqueta="Costo" valor={fmt(costoBase)} />
        <Cifra etiqueta="Precio" valor={fmt(p.precioVenta)} />
        <Cifra etiqueta="Neto sin IVA" valor={fmt(neto)} />
        <Cifra etiqueta="Food cost"
               valor={foodCost !== null ? `${foodCost.toFixed(1)}%` : '—'}
               alerta={foodCost !== null && foodCost > 100} />
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-stone-500 mb-2">Composición del costo</p>
        <GraficaDesglose detalle={p} />
      </div>

      {p.historial.length > 0 && (
        <div>
          <p className="text-xs font-medium text-stone-500 mb-2">Evolución</p>
          <GraficaHistorial historial={p.historial} ancho={ANCHO_GRAFICA} />
        </div>
      )}
    </article>
  )
}

function Cifra({ etiqueta, valor, alerta }: { etiqueta: string; valor: string; alerta?: boolean }) {
  return (
    <div className="border border-stone-200 rounded-lg px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wide text-stone-400">{etiqueta}</dt>
      <dd className={`font-semibold ${alerta ? 'text-red-600' : 'text-stone-800'}`}>{valor}</dd>
    </div>
  )
}
