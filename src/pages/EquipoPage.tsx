import { useState, useEffect, useCallback } from 'react'
import UsuariosPage from './UsuariosPage'
import Spinner from '../components/Spinner'
import { listarReasignacionesPropina } from '../api/ventas'
import { hoy, primerDiaDelMes } from '../utils/fecha'
import type { ReasignacionPropinaDTO } from '../types/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

type Seccion = 'personas' | 'reasignaciones'

const SECCIONES: { id: Seccion; label: string }[] = [
  { id: 'personas', label: 'Personas' },
  { id: 'reasignaciones', label: 'Propinas reasignadas' },
]

/** Todo lo del personal: quién es quién y lo que pasa con sus propinas. */
export default function EquipoPage() {
  const [seccion, setSeccion] = useState<Seccion>('personas')

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex gap-1 px-6 pt-5 border-b border-stone-100 flex-shrink-0">
        {SECCIONES.map((s) => (
          <button
            key={s.id}
            onClick={() => setSeccion(s.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              seccion === s.id
                ? 'border-forest text-forest'
                : 'border-transparent text-stone-400 hover:text-stone-600'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {seccion === 'personas' ? <UsuariosPage /> : <ReasignacionesPropina />}
    </div>
  )
}

/**
 * Bitácora de propinas que un supervisor pasó de una persona a otra: quién lo
 * autorizó, de quién a quién, de qué comanda, cuánto y cuándo.
 */
function ReasignacionesPropina() {
  const [desde, setDesde] = useState(primerDiaDelMes())
  const [hasta, setHasta] = useState(hoy())
  const [filas, setFilas] = useState<ReasignacionPropinaDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setFilas(await listarReasignacionesPropina(desde, hasta))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const total = filas.reduce((s, f) => s + f.propina, 0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Propinas reasignadas</h1>
          <p className="text-sm text-stone-400">Propinas de comandas que un supervisor pasó a otra persona.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className="input w-auto text-sm" />
          <span className="text-stone-400 text-sm">a</span>
          <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className="input w-auto text-sm" />
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-forest" /></div>
      ) : filas.length === 0 ? (
        <div className="card px-5 py-12 text-center text-sm text-stone-400">
          No hubo reasignaciones en estas fechas.
        </div>
      ) : (
        <>
          <p className="text-sm text-stone-500 mb-3">
            {filas.length} reasignaci{filas.length === 1 ? 'ón' : 'ones'} · {fmt(total)} en propinas
          </p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone-400 uppercase tracking-wide border-b border-stone-100">
                  <th className="px-4 py-3 font-medium">Cuándo</th>
                  <th className="px-4 py-3 font-medium">Comanda</th>
                  <th className="px-4 py-3 font-medium">De</th>
                  <th className="px-4 py-3 font-medium">Para</th>
                  <th className="px-4 py-3 font-medium">Autorizó</th>
                  <th className="px-4 py-3 font-medium text-right">Propina</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-stone-50 last:border-0">
                    <td className="px-4 py-3 text-stone-500 whitespace-nowrap">
                      {new Date(f.ocurridoEn).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-stone-700">
                      {f.ticketId ? `#${f.ticketId}` : '—'}
                      {f.comanda && <span className="text-stone-400"> · {f.comanda}</span>}
                      <span className="block text-xs text-stone-400">Venta #{f.ventaId}</span>
                    </td>
                    <td className="px-4 py-3 text-stone-700">{f.de ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-stone-800">{f.para}</td>
                    <td className="px-4 py-3 text-stone-700">{f.autorizo}</td>
                    <td className="px-4 py-3 text-right font-semibold text-stone-800">{fmt(f.propina)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
