import { useEffect, useState } from 'react'
import { obtenerCierreMensual } from '../api/cierresMensuales'

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function partesEnYucatan(): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Merida', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date())
  const num = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value)
  return { anio: num('year'), mes: num('month'), dia: num('day') }
}

function ultimoDiaDelMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate()
}

/** Mes al que le corresponde el cierre en este momento: el actual si hoy es su
 * último día, o el anterior si ya se pasó (para no perder el recordatorio si
 * no se cerró justo ese día). */
function mesObjetivo(): { anio: number; mes: number } {
  const { anio, mes, dia } = partesEnYucatan()
  if (dia >= ultimoDiaDelMes(anio, mes)) return { anio, mes }
  return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }
}

/** true mientras el mes objetivo (el actual en su último día, o el anterior si
 * se pasó la fecha) siga sin cerrarse. Independiente del reloj del dispositivo:
 * usa la fecha de Yucatán. El endpoint es admin-only, así que `enabled` debe
 * ser false para usuarios no admin (no solo para no mostrar el aviso). */
export function useCierreMensualPendiente(enabled: boolean): { anio: number; mes: number; nombreMes: string } | null {
  const [pendiente, setPendiente] = useState<{ anio: number; mes: number } | null>(null)

  useEffect(() => {
    if (!enabled) { setPendiente(null); return }
    let activo = true
    const revisar = () => {
      const objetivo = mesObjetivo()
      obtenerCierreMensual(objetivo.anio, objetivo.mes).then((c) => {
        if (activo) setPendiente(c ? null : objetivo)
      })
    }
    revisar()
    const id = setInterval(revisar, 5 * 60_000)
    return () => { activo = false; clearInterval(id) }
  }, [enabled])

  return pendiente ? { ...pendiente, nombreMes: NOMBRES_MES[pendiente.mes - 1] } : null
}
