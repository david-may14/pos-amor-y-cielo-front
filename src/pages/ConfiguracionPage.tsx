import { useState, useEffect } from 'react'
import { obtenerConfiguracion, actualizarConfiguracion } from '../api/configuracion'
import Spinner from '../components/Spinner'
import Toast from '../components/Toast'

export default function ConfiguracionPage() {
  const [iva, setIva] = useState('')
  const [comision, setComision] = useState('')
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    obtenerConfiguracion()
      .then((c) => {
        setIva(String(c.ivaPorcentaje))
        setComision(String(c.comisionTarjeta))
      })
      .catch(() => setError('No se pudo cargar la configuración'))
      .finally(() => setLoading(false))
  }, [])

  const handleGuardar = async () => {
    const ivaNum = parseFloat(iva)
    const comisionNum = parseFloat(comision)
    if (isNaN(ivaNum) || ivaNum < 0 || ivaNum > 50) {
      setError('IVA debe ser entre 0 y 50%')
      return
    }
    if (isNaN(comisionNum) || comisionNum < 0 || comisionNum > 20) {
      setError('Comisión debe ser entre 0 y 20%')
      return
    }
    setGuardando(true)
    setError('')
    try {
      const res = await actualizarConfiguracion({ ivaPorcentaje: ivaNum, comisionTarjeta: comisionNum })
      setIva(String(res.ivaPorcentaje))
      setComision(String(res.comisionTarjeta))
      setToastMsg('Configuración guardada')
    } catch {
      setError('Error al guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-forest" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold text-stone-800 mb-2">Configuración financiera</h1>
      <p className="text-sm text-stone-400 mb-8">
        Estos valores afectan el cálculo de utilidad en reportes. Los porcentajes se aplican a todas las ventas nuevas.
      </p>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}
      {toastMsg && <Toast message={toastMsg} onClose={() => setToastMsg('')} />}

      <div className="card px-6 py-6 space-y-6">
        {/* IVA */}
        <div>
          <label className="label">Porcentaje de IVA</label>
          <p className="text-xs text-stone-400 mb-2">
            Se asume que los precios ya incluyen IVA. Este porcentaje extrae la parte fiscal para reportes.
            Deja en 0 si no aplica.
          </p>
          <div className="relative max-w-xs">
            <input
              className="input pr-8"
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={iva}
              onChange={(e) => setIva(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">%</span>
          </div>
          {parseFloat(iva) > 0 && (
            <p className="text-xs text-stone-400 mt-1.5">
              Ejemplo: venta de $100 → IVA incluido{' '}
              <span className="font-medium text-stone-600">
                ${(100 * parseFloat(iva) / (100 + parseFloat(iva))).toFixed(2)}
              </span>
            </p>
          )}
        </div>

        <div className="border-t border-stone-100" />

        {/* Comisión terminal */}
        <div>
          <label className="label">Comisión por terminal bancaria</label>
          <p className="text-xs text-stone-400 mb-2">
            Porcentaje que cobra el banco/terminal sobre el total de ventas pagadas con tarjeta.
            Deja en 0 si no aplica o si absorbes el costo de otra forma.
          </p>
          <div className="relative max-w-xs">
            <input
              className="input pr-8"
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={comision}
              onChange={(e) => setComision(e.target.value)}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">%</span>
          </div>
          {parseFloat(comision) > 0 && (
            <p className="text-xs text-stone-400 mt-1.5">
              Ejemplo: venta de $100 con tarjeta → comisión{' '}
              <span className="font-medium text-stone-600">
                ${(100 * parseFloat(comision) / 100).toFixed(2)}
              </span>
            </p>
          )}
        </div>

        <div className="border-t border-stone-100 pt-2">
          <button
            onClick={handleGuardar}
            disabled={guardando}
            className="btn-primary flex items-center gap-2"
          >
            {guardando && <Spinner className="w-4 h-4 text-cream" />}
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div className="mt-6 card px-5 py-4 bg-amber-50/50 border border-amber-100">
        <p className="text-xs font-semibold text-amber-700 mb-1">Nota importante</p>
        <p className="text-xs text-amber-600">
          Los cambios aplican a ventas futuras. Las ventas ya registradas conservan los montos calculados
          al momento de su creación.
        </p>
      </div>
    </div>
  )
}
