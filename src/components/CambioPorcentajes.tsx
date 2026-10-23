import { useState, useEffect } from 'react'
import { recalcularPeriodo, listarRecalculos } from '../api/configuracion'
import type { RecalculoDTO, RecalculoResultado } from '../types/api'
import { hoy } from '../utils/fecha'
import Modal from './Modal'
import Spinner from './Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

interface Cambio {
  antes: number
  despues: number
}

/**
 * Se abre al guardar otro IVA o comisión: pregunta desde qué día ya se cobraba
 * así, para corregir las ventas de esas fechas en el mismo paso.
 *
 * Sin fechas no se guarda nada. Cada venta guarda con qué porcentaje se cobró,
 * y un cambio sin fechas dejaría mal las de los días en que la terminal ya
 * cobraba el nuevo y aquí seguía el viejo.
 */
export function ModalFechasPorcentaje({ iva, comision, onGuardar, onCerrar }: {
  /** null si no cambia */
  iva: Cambio | null
  comision: Cambio | null
  onGuardar: (desde: string, hasta: string) => Promise<void>
  onCerrar: () => void
}) {
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState(hoy())
  const [revision, setRevision] = useState<RecalculoResultado | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const fechasValidas = desde !== '' && hasta !== '' && desde <= hasta

  // El impacto se revisa solo en cuanto hay fechas
  useEffect(() => {
    setRevision(null)
    setError('')
    if (!fechasValidas) return
    let vigente = true
    setRevisando(true)
    recalcularPeriodo({
      desde, hasta, aplicar: false,
      ivaPorcentaje: iva?.despues ?? null,
      comisionTarjeta: comision?.despues ?? null,
    })
      .then((r) => { if (vigente) setRevision(r) })
      .catch((e: unknown) => { if (vigente) setError(e instanceof Error ? e.message : 'No se pudo revisar el impacto') })
      .finally(() => { if (vigente) setRevisando(false) })
    return () => { vigente = false }
  }, [desde, hasta, fechasValidas, iva, comision])

  const guardar = async () => {
    if (!fechasValidas) { setError('Indica desde qué día'); return }
    setGuardando(true)
    setError('')
    try {
      await onGuardar(desde, hasta)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
      setGuardando(false)
    }
  }

  return (
    <Modal title="¿Desde qué día aplica?" onClose={onCerrar} size="sm">
      <div className="space-y-4">
        <div className="text-sm text-stone-600 space-y-0.5">
          {iva && <p>IVA: {iva.antes}% → <strong>{iva.despues}%</strong></p>}
          {comision && <p>Comisión tarjeta: {comision.antes}% → <strong>{comision.despues}%</strong></p>}
        </div>
        <p className="text-xs text-stone-500">
          Las ventas de estas fechas se recalculan con el nuevo porcentaje; las de antes conservan el suyo.
          Si cancelas, no se guarda nada.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-stone-500">Desde
            <input type="date" className="input text-sm mt-1" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className="text-xs text-stone-500">Hasta
            <input type="date" className="input text-sm mt-1" value={hasta} min={desde} max={hoy()} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>

        {revisando && <p className="text-xs text-stone-400 flex items-center gap-2"><Spinner className="w-3 h-3" /> Revisando ventas…</p>}
        {revision && (
          <div className="text-sm bg-stone-50 rounded-lg px-4 py-3 space-y-1">
            <p className="text-stone-600">
              {revision.ventas === 0 ? 'No hay ventas en esas fechas' : `${revision.ventas} ventas en esas fechas`}
            </p>
            {revision.ventas > 0 && iva && (
              <div className="flex justify-between"><span className="text-stone-500">IVA</span>
                <span>{fmt(revision.ivaAntes)} → <strong>{fmt(revision.ivaDespues)}</strong></span></div>
            )}
            {revision.ventas > 0 && comision && (
              <div className="flex justify-between"><span className="text-stone-500">Comisiones</span>
                <span>{fmt(revision.comisionAntes)} → <strong>{fmt(revision.comisionDespues)}</strong></span></div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onCerrar} className="btn-secondary text-sm">Cancelar</button>
          <button onClick={guardar} disabled={!revision || guardando} className="btn-primary text-sm flex items-center gap-2">
            {guardando && <Spinner className="w-4 h-4 text-cream" />}
            {revision && revision.ventas > 0 ? `Guardar y corregir ${revision.ventas} ventas` : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Las correcciones de porcentaje que ya se aplicaron, para saber qué se tocó y quién. */
export function HistorialCorrecciones({ recargar }: { recargar: number }) {
  const [historial, setHistorial] = useState<RecalculoDTO[]>([])

  useEffect(() => { listarRecalculos().then(setHistorial).catch(() => {}) }, [recargar])

  if (historial.length === 0) return null
  return (
    <div className="mt-6 card px-5 py-4 space-y-1.5">
      <p className="text-xs font-medium text-stone-600">Ventas corregidas al cambiar porcentajes</p>
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
  )
}
