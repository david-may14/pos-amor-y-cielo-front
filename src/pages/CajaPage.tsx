import { useState, useEffect, useCallback } from 'react'
import { obtenerTurnoActivo, abrirTurno, cerrarTurno, listarTurnos, registrarMovimiento } from '../api/turnos'
import type { TurnoDTO } from '../types/api'
import { useAuth } from '../contexts/AuthContext'
import Spinner from '../components/Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const fmtHora = (s: string) =>
  new Date(s).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })

const fmtFecha = (s: string) =>
  new Date(s).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })

const hoy = () => new Date().toISOString().split('T')[0]

export default function CajaPage() {
  const { isAdmin } = useAuth()

  const [turnoActivo, setTurnoActivo] = useState<TurnoDTO | null>(null)
  const [loadingActivo, setLoadingActivo] = useState(true)
  const [error, setError] = useState('')

  // Apertura
  const [fondoInicial, setFondoInicial] = useState('')
  const [abriendo, setAbriendo] = useState(false)

  // Cierre
  const [mostraCierre, setMostraCierre] = useState(false)
  const [conteoEfectivo, setConteoEfectivo] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [cerrando, setCerrando] = useState(false)

  // Movimiento de caja
  const [tipoMovimiento, setTipoMovimiento] = useState<'ENTRADA' | 'SALIDA' | null>(null)
  const [montoMovimiento, setMontoMovimiento] = useState('')
  const [motivoMovimiento, setMotivoMovimiento] = useState('')
  const [guardandoMov, setGuardandoMov] = useState(false)

  // Historial (admin)
  const [fecha, setFecha] = useState(hoy())
  const [historial, setHistorial] = useState<TurnoDTO[]>([])
  const [loadingHist, setLoadingHist] = useState(false)

  const cargarActivo = useCallback(async () => {
    setLoadingActivo(true)
    try {
      const t = await obtenerTurnoActivo()
      setTurnoActivo(t)
    } catch {
      setTurnoActivo(null)
    } finally {
      setLoadingActivo(false)
    }
  }, [])

  const cargarHistorial = useCallback(async () => {
    if (!isAdmin) return
    setLoadingHist(true)
    try {
      setHistorial(await listarTurnos(fecha))
    } catch {
      setHistorial([])
    } finally {
      setLoadingHist(false)
    }
  }, [fecha, isAdmin])

  useEffect(() => { cargarActivo() }, [cargarActivo])
  useEffect(() => { cargarHistorial() }, [cargarHistorial])

  const handleAbrir = async () => {
    const fondo = parseFloat(fondoInicial) || 0
    setAbriendo(true)
    setError('')
    try {
      const t = await abrirTurno(fondo)
      setTurnoActivo(t)
      setFondoInicial('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al abrir turno')
    } finally {
      setAbriendo(false)
    }
  }

  const handleCerrar = async () => {
    const conteo = parseFloat(conteoEfectivo)
    if (isNaN(conteo) || conteo < 0) { setError('Ingresa un conteo válido'); return }
    setCerrando(true)
    setError('')
    try {
      const t = await cerrarTurno(conteo, notasCierre || undefined)
      setTurnoActivo(null)
      setMostraCierre(false)
      setConteoEfectivo('')
      setNotasCierre('')
      cargarHistorial()
      setHistorial(prev => [t, ...prev.filter(x => x.id !== t.id)])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cerrar turno')
    } finally {
      setCerrando(false)
    }
  }

  const handleMovimiento = async () => {
    if (!tipoMovimiento) return
    const monto = parseFloat(montoMovimiento)
    if (isNaN(monto) || monto <= 0) { setError('Ingresa un monto válido'); return }
    if (!motivoMovimiento.trim()) { setError('El motivo es obligatorio'); return }
    setGuardandoMov(true)
    setError('')
    try {
      const t = await registrarMovimiento(tipoMovimiento, monto, motivoMovimiento.trim())
      setTurnoActivo(t)
      setTipoMovimiento(null)
      setMontoMovimiento('')
      setMotivoMovimiento('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar movimiento')
    } finally {
      setGuardandoMov(false)
    }
  }

  const cancelarMovimiento = () => {
    setTipoMovimiento(null)
    setMontoMovimiento('')
    setMotivoMovimiento('')
    setError('')
  }

  if (loadingActivo) {
    return <div className="flex-1 flex items-center justify-center"><Spinner className="w-8 h-8 text-forest" /></div>
  }

  const efectivoEsperado = turnoActivo
    ? (turnoActivo.fondoInicial + (turnoActivo.ventasEfectivo ?? 0) + (turnoActivo.movimientosNeto ?? 0))
    : 0
  const conteoNum = parseFloat(conteoEfectivo) || 0
  const diferenciaPreview = conteoNum - efectivoEsperado

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold text-stone-800 mb-6">Caja</h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
      )}

      {/* ── Sin turno activo ── */}
      {!turnoActivo && (
        <div className="card px-6 py-8 text-center space-y-5">
          <div>
            <p className="text-stone-400 text-sm mb-1">No hay turno abierto</p>
            <p className="text-xs text-stone-300">Abre el turno para comenzar a registrar ventas.</p>
          </div>
          <div className="max-w-xs mx-auto space-y-3">
            <div>
              <label className="label text-left">Fondo inicial (efectivo en caja)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                <input
                  className="input pl-6"
                  type="number"
                  min={0}
                  step="10"
                  placeholder="0.00"
                  value={fondoInicial}
                  onChange={(e) => setFondoInicial(e.target.value)}
                />
              </div>
            </div>
            <button
              onClick={handleAbrir}
              disabled={abriendo}
              className="btn-primary w-full flex justify-center gap-2"
            >
              {abriendo && <Spinner className="w-4 h-4 text-cream" />}
              {abriendo ? 'Abriendo…' : 'Abrir turno'}
            </button>
          </div>
        </div>
      )}

      {/* ── Turno activo ── */}
      {turnoActivo && !mostraCierre && !tipoMovimiento && (
        <div className="space-y-4">
          {/* Estado del turno */}
          <div className="card px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-stone-400">Turno abierto desde</p>
                <p className="font-semibold text-stone-800">{fmtHora(turnoActivo.abiertoEn)}</p>
                <p className="text-xs text-stone-400 mt-0.5">por {turnoActivo.usuarioNombre}</p>
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-medium px-3 py-1 rounded-full">ABIERTO</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-stone-100 pt-4">
              <div className="text-center">
                <p className="text-xs text-stone-400 mb-1">Fondo inicial</p>
                <p className="font-semibold text-stone-700">{fmt(turnoActivo.fondoInicial)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-400 mb-1">Ventas ({turnoActivo.ventasCountActual ?? 0})</p>
                <p className="font-semibold text-forest">{fmt(turnoActivo.ventasTotalActual ?? 0)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-400 mb-1">Efectivo esperado</p>
                <p className="font-semibold text-stone-700">{fmt(efectivoEsperado)}</p>
              </div>
            </div>

            {/* Movimientos neto si hay alguno */}
            {(turnoActivo.movimientosNeto ?? 0) !== 0 && (
              <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-500 flex justify-between">
                <span>Movimientos de caja</span>
                <span className={(turnoActivo.movimientosNeto ?? 0) >= 0 ? 'text-blue-600 font-medium' : 'text-red-500 font-medium'}>
                  {(turnoActivo.movimientosNeto ?? 0) >= 0 ? '+' : ''}{fmt(turnoActivo.movimientosNeto ?? 0)}
                </span>
              </div>
            )}
          </div>

          {/* Lista de movimientos */}
          {turnoActivo.movimientos.length > 0 && (
            <div className="card px-5 py-4">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Movimientos de caja</p>
              <div className="space-y-2">
                {turnoActivo.movimientos.map((m) => (
                  <div key={m.id} className="flex items-start justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        m.tipo === 'ENTRADA' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-500'
                      }`}>
                        {m.tipo === 'ENTRADA' ? '↑ Entrada' : '↓ Salida'}
                      </span>
                      <span className="text-stone-600">{m.motivo}</span>
                    </div>
                    <span className={`font-semibold shrink-0 ml-3 ${m.tipo === 'ENTRADA' ? 'text-blue-600' : 'text-red-500'}`}>
                      {m.tipo === 'ENTRADA' ? '+' : '-'}{fmt(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => { setTipoMovimiento('ENTRADA'); setError('') }}
              className="py-3 text-sm font-medium rounded-xl border-2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors"
            >
              + Entrada de efectivo
            </button>
            <button
              onClick={() => { setTipoMovimiento('SALIDA'); setError('') }}
              className="py-3 text-sm font-medium rounded-xl border-2 border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition-colors"
            >
              − Salida de efectivo
            </button>
          </div>

          <button
            onClick={() => { setMostraCierre(true); setError('') }}
            className="w-full py-3 text-sm font-medium rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 hover:border-red-400 transition-colors"
          >
            Cerrar turno
          </button>
        </div>
      )}

      {/* ── Formulario de movimiento ── */}
      {turnoActivo && tipoMovimiento && (
        <div className="card px-6 py-6 space-y-5">
          <h2 className="font-semibold text-stone-800">
            {tipoMovimiento === 'ENTRADA' ? '+ Entrada de efectivo' : '− Salida de efectivo'}
          </h2>

          <div>
            <label className="label">Monto</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
              <input
                className="input pl-6"
                type="number"
                min={0.01}
                step="0.50"
                placeholder="0.00"
                value={montoMovimiento}
                onChange={(e) => setMontoMovimiento(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="label">Motivo <span className="text-red-400">*</span></label>
            <input
              className="input"
              placeholder={tipoMovimiento === 'SALIDA' ? 'Ej. Pago proveedor leche' : 'Ej. Cambio recibido de gerencia'}
              value={motivoMovimiento}
              onChange={(e) => setMotivoMovimiento(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={cancelarMovimiento}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleMovimiento}
              disabled={guardandoMov || !montoMovimiento || !motivoMovimiento.trim()}
              className={`btn-primary flex-1 flex justify-center gap-2 ${
                tipoMovimiento === 'SALIDA' ? 'bg-orange-500 hover:bg-orange-600 border-orange-500' : ''
              }`}
            >
              {guardandoMov && <Spinner className="w-4 h-4 text-cream" />}
              {guardandoMov ? 'Guardando…' : 'Registrar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Formulario de cierre ── */}
      {turnoActivo && mostraCierre && (
        <div className="card px-6 py-6 space-y-5">
          <h2 className="font-semibold text-stone-800">Cerrar turno</h2>

          {/* Resumen esperado */}
          <div className="bg-surface-muted rounded-xl px-4 py-4 space-y-2 text-sm">
            <div className="flex justify-between text-stone-500">
              <span>Fondo inicial</span>
              <span>{fmt(turnoActivo.fondoInicial)}</span>
            </div>
            <div className="flex justify-between text-stone-500">
              <span>Ventas en efectivo</span>
              <span>+{fmt(turnoActivo.ventasEfectivo ?? 0)}</span>
            </div>
            {(turnoActivo.movimientosNeto ?? 0) !== 0 && (
              <div className="flex justify-between text-stone-500">
                <span>Movimientos de caja</span>
                <span className={(turnoActivo.movimientosNeto ?? 0) >= 0 ? 'text-blue-600' : 'text-red-500'}>
                  {(turnoActivo.movimientosNeto ?? 0) >= 0 ? '+' : ''}{fmt(turnoActivo.movimientosNeto ?? 0)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-stone-800 border-t border-stone-200 pt-2 mt-1">
              <span>Efectivo esperado</span>
              <span>{fmt(efectivoEsperado)}</span>
            </div>
          </div>

          {/* Conteo real */}
          <div>
            <label className="label">Tu conteo de efectivo</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
              <input
                className="input pl-6"
                type="number"
                min={0}
                step="0.50"
                placeholder="0.00"
                value={conteoEfectivo}
                onChange={(e) => setConteoEfectivo(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {/* Diferencia en tiempo real */}
          {conteoEfectivo !== '' && (
            <div className={`flex justify-between text-sm font-semibold px-4 py-3 rounded-xl ${
              diferenciaPreview === 0 ? 'bg-green-50 text-green-700' :
              diferenciaPreview > 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-600'
            }`}>
              <span>{diferenciaPreview > 0 ? 'Sobra' : diferenciaPreview < 0 ? 'Falta' : 'Cuadra exacto'}</span>
              <span>{diferenciaPreview !== 0 ? fmt(Math.abs(diferenciaPreview)) : '✓'}</span>
            </div>
          )}

          <div>
            <label className="label">Notas (opcional)</label>
            <input
              className="input"
              placeholder="Ej. Se encontraron $20 de más en fondo"
              value={notasCierre}
              onChange={(e) => setNotasCierre(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setMostraCierre(false); setError('') }}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleCerrar}
              disabled={cerrando || conteoEfectivo === ''}
              className="btn-primary flex-1 flex justify-center gap-2 bg-red-500 hover:bg-red-600 border-red-500"
            >
              {cerrando && <Spinner className="w-4 h-4 text-cream" />}
              {cerrando ? 'Cerrando…' : 'Confirmar cierre'}
            </button>
          </div>
        </div>
      )}

      {/* ── Historial (admin) ── */}
      {isAdmin && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-stone-700">Historial de turnos</h2>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="input w-auto text-sm"
            />
          </div>

          {loadingHist ? (
            <div className="flex justify-center py-8"><Spinner className="w-6 h-6 text-forest" /></div>
          ) : historial.length === 0 ? (
            <div className="card px-6 py-10 text-center text-stone-400 text-sm">
              Sin turnos registrados para esta fecha.
            </div>
          ) : (
            <div className="space-y-3">
              {historial.map((t) => {
                const diff = t.diferencia ?? 0
                const neto = t.movimientosNeto ?? 0
                return (
                  <div key={t.id} className="card px-5 py-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-sm font-medium text-stone-800">Turno #{t.id}</p>
                        <p className="text-xs text-stone-400">{t.usuarioNombre} · {fmtFecha(t.abiertoEn)}</p>
                      </div>
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        t.estado === 'ABIERTO' ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                      }`}>
                        {t.estado}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div>
                        <p className="text-stone-400">Fondo inicial</p>
                        <p className="font-medium text-stone-700">{fmt(t.fondoInicial)}</p>
                      </div>
                      <div>
                        <p className="text-stone-400">Ventas efectivo</p>
                        <p className="font-medium text-stone-700">{t.ventasEfectivo != null ? fmt(t.ventasEfectivo) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-stone-400">Conteo</p>
                        <p className="font-medium text-stone-700">{t.conteoEfectivo != null ? fmt(t.conteoEfectivo) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-stone-400">Diferencia</p>
                        <p className={`font-semibold ${diff > 0 ? 'text-blue-600' : diff < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {t.diferencia != null ? (diff >= 0 ? '+' : '') + fmt(diff) : '—'}
                        </p>
                      </div>
                    </div>

                    {neto !== 0 && (
                      <p className="text-xs text-stone-400 mt-2 pt-2 border-t border-stone-50">
                        Movimientos de caja: <span className={neto >= 0 ? 'text-blue-500' : 'text-red-400'}>{neto >= 0 ? '+' : ''}{fmt(neto)}</span>
                      </p>
                    )}

                    {t.movimientos.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-stone-50 space-y-1">
                        {t.movimientos.map((m) => (
                          <div key={m.id} className="flex justify-between text-xs text-stone-400">
                            <span>
                              <span className={m.tipo === 'ENTRADA' ? 'text-blue-500' : 'text-orange-500'}>
                                {m.tipo === 'ENTRADA' ? '↑' : '↓'}
                              </span>
                              {' '}{m.motivo}
                            </span>
                            <span className={m.tipo === 'ENTRADA' ? 'text-blue-500' : 'text-orange-500'}>
                              {m.tipo === 'ENTRADA' ? '+' : '-'}{fmt(m.monto)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {t.notas && (
                      <p className="text-xs text-stone-400 italic mt-2 border-t border-stone-50 pt-2">
                        {t.notas}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
