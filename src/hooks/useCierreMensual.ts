import { useEffect, useState } from 'react'
import { mesPendienteDeCerrar } from '../api/cierresMensuales'

const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

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
      // La regla la aplica el servidor: qué mes toca, y si tuvo ventas.
      mesPendienteDeCerrar()
        .then((m) => { if (activo) setPendiente(m) })
        .catch(() => { if (activo) setPendiente(null) })
    }
    revisar()
    const id = setInterval(revisar, 5 * 60_000)
    return () => { activo = false; clearInterval(id) }
  }, [enabled])

  return pendiente ? { ...pendiente, nombreMes: NOMBRES_MES[pendiente.mes - 1] } : null
}
