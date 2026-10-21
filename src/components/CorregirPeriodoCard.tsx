import { useState, useEffect } from 'react'
import { recalcularPeriodo, listarRecalculos } from '../api/configuracion'
import type { RecalculoDTO, RecalculoResultado } from '../types/api'
import { hoy, diasAtras } from '../utils/fecha'
import Spinner from './Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

/**
 * Aplica otro IVA o comisión a las ventas de unas fechas.
 *
 * Cambiar la configuración solo afecta lo que se cobra de ahí en adelante. Esto
 * es para los días en que la terminal ya cobraba otra comisión y todavía no se
 * había cambiado aquí. Se limita a las fechas indicadas a propósito: cada venta
 * guarda con qué porcentaje se cobró, y las de otros días conservan el suyo.
 *
 * Primero se revisa el impacto y después se aplica, en dos pasos.
 */
export default function CorregirPeriodoCard() {
  const [desde, setDesde] = useState(diasAtras(7))
  const [hasta, setHasta] = useState(hoy())
  const [iva, setIva] = useState('')
  const [comision, setComision] = useState('')
  const [revision, setRevision] = useState<RecalculoResultado | null>(null)
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [historial, setHistorial] = useState<RecalculoDTO[]>([])

  const cargarHistorial = () => listarRecalculos().then(setHistorial).catch(() => {})
  useEffect(() => { cargarHistorial() }, [])

  // Cualquier cambio en los datos invalida la revisión anterior
  useEffect(() => { setRevision(null) }, [desde, hasta, iva, comision])

  const pedido = (aplicar: boolean) => ({
    desde, hasta, aplicar,
    ivaPorcentaje: iva.trim() === '' ? null : parseFloat(iva),
    comisionTarjeta: comision.trim() === '' ? null : parseFloat(comision),
  })

  const ejecutar = async (aplicar: boolean) => {
    const req = pedido(aplicar)
    if (req.ivaPorcentaje === null && req.comisionTarjeta === null) {
      setError('Escribe el IVA o la comisión que se cobró en esas fechas')
      return
    }
    setTrabajando(true)
    setError('')
    setAviso('')
    try {
      const res = await recalcularPeriodo(req)
      if (aplicar) {
        setRevision(null)
        setAviso(`Listo: ${res.ventas} ventas corregidas.`)
        cargarHistorial()
      } else {
        setRevision(res)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo recalcular')
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <div className="mt-6 card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-stone-700">Corregir ventas de unas fechas</h2>
        <p className="text-xs text-stone-400 mt-1">
          Si la terminal cobró otra comisión (o el IVA era otro) antes de cambiarlo aquí, aplica el
          porcentaje real solo a esos días. Deja vacío lo que no cambia.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-stone-500">Desde
          <input type="date" className="input text-sm mt-1" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </label>
        <label className="text-xs text-stone-500">Hasta
          <input type="date" className="input text-sm mt-1" value={hasta} min={desde} max={hoy()} onChange={(e) => setHasta(e.target.value)} />
        </label>
        <label className="text-xs text-stone-500">IVA (%)
          <input type="number" min={0} max={50} step="0.01" className="input text-sm mt-1" placeholder="sin cambio"
            value={iva} onChange={(e) => setIva(e.target.value)} />
        </label>
        <label className="text-xs text-stone-500">Comisión tarjeta (%)
          <input type="number" min={0} max={20} step="0.01" className="input text-sm mt-1" placeholder="sin cambio"
            value={comision} onChange={(e) => setComision(e.target.value)} />
        </label>
      </div>

      {revision && (
        <div className="text-sm bg-stone-50 rounded-lg px-4 py-3 space-y-1">
          <p className="text-stone-600">{revision.ventas} ventas en esas fechas</p>
          <div className="flex justify-between"><span className="text-stone-500">IVA</span>
            <span>{fmt(revision.ivaAntes)} → <strong>{fmt(revision.ivaDespues)}</strong></span></div>
          <div className="flex justify-between"><span className="text-stone-500">Comisiones</span>
            <span>{fmt(revision.comisionAntes)} → <strong>{fmt(revision.comisionDespues)}</strong></span></div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
      {aviso && <p className="text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">{aviso}</p>}

      <div className="flex gap-2">
        <button onClick={() => ejecutar(false)} disabled={trabajando} className="btn-secondary text-sm flex items-center gap-2">
          {trabajando && !revision && <Spinner className="w-4 h-4" />}
          Revisar impacto
        </button>
        {revision && revision.ventas > 0 && (
          <button onClick={() => ejecutar(true)} disabled={trabajando} className="btn-primary text-sm flex items-center gap-2">
            {trabajando && <Spinner className="w-4 h-4 text-cream" />}
            Aplicar a {revision.ventas} ventas
          </button>
        )}
      </div>

      {historial.length > 0 && (
        <div className="border-t border-stone-100 pt-3 space-y-1.5">
          <p className="text-xs font-medium text-stone-600">Correcciones aplicadas</p>
          {historial.map((r) => (
            <p key={r.id} className="text-xs text-stone-500">
              {r.desde} a {r.hasta}
              {r.ivaPorcentaje != null ? ` · IVA ${r.ivaPorcentaje}%` : ''}
              {r.comisionTarjeta != null ? ` · comisión ${r.comisionTarjeta}%` : ''}
              {' · '}{r.ventas} ventas · comisiones {fmt(r.comisionAntes)} → {fmt(r.comisionDespues)}
              {r.usuario ? ` · ${r.usuario}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
