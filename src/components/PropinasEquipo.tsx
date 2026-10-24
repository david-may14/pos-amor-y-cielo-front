import { useState, useEffect, useCallback } from 'react'
import Modal from './Modal'
import Spinner from './Spinner'
import { listarPagosPropina, pagarPropina, resumenPropinas } from '../api/propinas'
import { useTurno } from '../contexts/TurnoContext'
import { diasAtras, hoy, primerDiaDelMes } from '../utils/fecha'
import type {
  MetodoPagoPropina, PropinaBaristaResumen, PropinaPagoDTO, ResumenPropinasDTO,
} from '../types/api'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const fmtDia = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

/** Días desde el lunes de esta semana (lunes = 0). */
function diasDesdeLunes(): number {
  const [a, m, d] = hoy().split('-').map(Number)
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7
}

const PERIODOS: { id: string; label: string; rango: () => [string, string] }[] = [
  { id: 'semana', label: 'Esta semana', rango: () => [diasAtras(diasDesdeLunes()), hoy()] },
  {
    id: 'semana-pasada', label: 'Semana pasada',
    rango: () => [diasAtras(diasDesdeLunes() + 7), diasAtras(diasDesdeLunes() + 1)],
  },
  { id: 'mes', label: 'Este mes', rango: () => [primerDiaDelMes(), hoy()] },
]

/**
 * Propinas del personal: lo que ganó cada quien en el periodo, lo que se le
 * pagó y lo que se le debe hoy. Desde aquí se registra cada entrega.
 */
export default function PropinasEquipo() {
  const [periodo, setPeriodo] = useState('semana')
  const [[desde, hasta], setRango] = useState<[string, string]>(PERIODOS[0].rango())
  const [resumen, setResumen] = useState<ResumenPropinasDTO | null>(null)
  const [pagos, setPagos] = useState<PropinaPagoDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pagando, setPagando] = useState<PropinaBaristaResumen | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [r, p] = await Promise.all([resumenPropinas(desde, hasta), listarPagosPropina(desde, hasta)])
      setResumen(r)
      setPagos(p)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  const elegirPeriodo = (id: string) => {
    setPeriodo(id)
    const p = PERIODOS.find((x) => x.id === id)
    if (p) setRango(p.rango())
  }

  const filas = resumen?.baristas ?? []
  const totalGanado = filas.reduce((s, f) => s + f.ganado, 0)
  const totalSaldo = filas.reduce((s, f) => s + Math.max(0, f.saldo), 0)

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Propinas</h1>
          <p className="text-sm text-stone-400">
            Lo que ganó cada quien por las ventas que atendió, lo que se le pagó y lo que se le debe.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => elegirPeriodo(p.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                periodo === p.id ? 'border-forest bg-forest/5 text-forest' : 'border-stone-200 text-stone-500 hover:bg-stone-50'
              }`}
            >
              {p.label}
            </button>
          ))}
          <input
            type="date" value={desde} max={hasta} className="input w-auto text-sm"
            onChange={(e) => { setPeriodo(''); setRango([e.target.value, hasta]) }}
          />
          <span className="text-stone-400 text-sm">a</span>
          <input
            type="date" value={hasta} min={desde} className="input w-auto text-sm"
            onChange={(e) => { setPeriodo(''); setRango([desde, e.target.value]) }}
          />
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="w-8 h-8 text-forest" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5 max-w-md">
            <div className="card px-4 py-3">
              <p className="text-xs text-stone-400">Ganado en el periodo</p>
              <p className="text-lg font-semibold text-stone-800">{fmt(totalGanado)}</p>
            </div>
            <div className="card px-4 py-3">
              <p className="text-xs text-stone-400">Por pagar hoy</p>
              <p className="text-lg font-semibold text-amber-700">{fmt(totalSaldo)}</p>
            </div>
          </div>

          {filas.length === 0 ? (
            <div className="card px-5 py-12 text-center text-sm text-stone-400">
              No hay propinas en estas fechas.
            </div>
          ) : (
            <div className="card overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-stone-400 uppercase tracking-wide border-b border-stone-100">
                    <th className="px-4 py-3 font-medium">Barista</th>
                    <th className="px-4 py-3 font-medium text-right">Ventas</th>
                    <th className="px-4 py-3 font-medium text-right">Efectivo</th>
                    <th className="px-4 py-3 font-medium text-right">Tarjeta</th>
                    <th className="px-4 py-3 font-medium text-right">Ganado</th>
                    <th className="px-4 py-3 font-medium text-right">Pagado</th>
                    <th className="px-4 py-3 font-medium text-right">Por pagar</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.usuarioId} className="border-b border-stone-50 last:border-0">
                      <td className="px-4 py-3 font-medium text-stone-800">{f.nombre}</td>
                      <td className="px-4 py-3 text-right text-stone-500">{f.ventas}</td>
                      <td className="px-4 py-3 text-right text-stone-700">{fmt(f.propinaEfectivo)}</td>
                      <td className="px-4 py-3 text-right text-stone-700">{fmt(f.propinaTarjeta)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-stone-800">{fmt(f.ganado)}</td>
                      <td className="px-4 py-3 text-right text-stone-700">{fmt(f.pagado)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        f.saldo > 0 ? 'text-amber-700' : f.saldo < 0 ? 'text-red-600' : 'text-stone-400'
                      }`}>
                        {fmt(f.saldo)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setPagando(f)} className="text-xs font-medium text-forest hover:underline">
                          Pagar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resumen && (
            <p className="text-xs text-stone-400 mb-6">
              "Por pagar" cuenta desde el {fmtDia(resumen.saldoDesde)}, sin importar las fechas elegidas.
              Un saldo negativo es un adelanto.
            </p>
          )}

          <h2 className="text-sm font-semibold text-stone-600 mb-2">Pagos en el periodo</h2>
          {pagos.length === 0 ? (
            <p className="text-sm text-stone-400">No se registraron pagos en estas fechas.</p>
          ) : (
            <div className="card divide-y divide-stone-50">
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-800">{p.nombre}</p>
                    <p className="text-xs text-stone-400">
                      {new Date(p.pagadoEn).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                      {' · '}{p.metodo === 'EFECTIVO' ? (p.deCaja ? 'Efectivo del cajón' : 'Efectivo') : 'Transferencia'}
                      {p.pagadoPor && ` · pagó ${p.pagadoPor}`}
                      {p.nota && ` · ${p.nota}`}
                    </p>
                  </div>
                  <span className="font-semibold text-stone-800">{fmt(p.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pagando && (
        <PagarPropinaModal
          barista={pagando}
          onClose={() => setPagando(null)}
          onPagado={() => { setPagando(null); cargar() }}
        />
      )}
    </div>
  )
}

function PagarPropinaModal({ barista, onClose, onPagado }: {
  barista: PropinaBaristaResumen
  onClose: () => void
  onPagado: () => void
}) {
  const { turno } = useTurno()
  const [monto, setMonto] = useState(barista.saldo > 0 ? String(barista.saldo) : '')
  const [metodo, setMetodo] = useState<MetodoPagoPropina>('EFECTIVO')
  const [salidaCaja, setSalidaCaja] = useState(!!turno)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const montoNum = Math.round((parseFloat(monto) || 0) * 100) / 100
  const deCaja = metodo === 'EFECTIVO' && salidaCaja && !!turno

  const guardar = async () => {
    if (montoNum <= 0) { setError('Escribe el monto'); return }
    setGuardando(true)
    setError('')
    try {
      await pagarPropina({ usuarioId: barista.usuarioId, monto: montoNum, metodo, nota: nota.trim() || null, salidaCaja: deCaja })
      onPagado()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo registrar el pago')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal title={`Pagar propina a ${barista.nombre}`} onClose={onClose} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-stone-500">
          Por pagar: <span className="font-semibold text-stone-800">{fmt(barista.saldo)}</span>
        </p>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Monto</label>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={monto}
            onChange={(e) => setMonto(e.target.value)} className="input w-full" />
          {montoNum > barista.saldo && barista.saldo >= 0 && (
            <p className="text-xs text-amber-700 mt-1">
              Es más de lo que se le debe: la diferencia queda como adelanto.
            </p>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Cómo</label>
          <div className="grid grid-cols-2 gap-2">
            {(['EFECTIVO', 'TRANSFERENCIA'] as const).map((m) => (
              <button key={m} onClick={() => setMetodo(m)}
                className={`py-2 text-sm font-medium rounded-lg border transition-colors ${
                  metodo === m ? 'border-forest bg-forest/5 text-forest' : 'border-stone-200 text-stone-500'
                }`}>
                {m === 'EFECTIVO' ? 'Efectivo' : 'Transferencia'}
              </button>
            ))}
          </div>
        </div>
        {metodo === 'EFECTIVO' && (
          turno ? (
            <label className="flex items-start gap-2 text-sm text-stone-600">
              <input type="checkbox" checked={salidaCaja} onChange={(e) => setSalidaCaja(e.target.checked)} className="mt-0.5" />
              <span>Sale del cajón del turno abierto <span className="block text-xs text-stone-400">Se anota como salida de caja para que el corte cuadre.</span></span>
            </label>
          ) : (
            <p className="text-xs text-stone-400">No hay turno abierto: el efectivo no se descuenta de ningún cajón.</p>
          )
        )}
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">Nota (opcional)</label>
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. semana del 20 al 26"
            className="input w-full" maxLength={255} />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="btn-primary flex-1">
            {guardando ? 'Guardando…' : `Pagar ${montoNum > 0 ? fmt(montoNum) : ''}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
