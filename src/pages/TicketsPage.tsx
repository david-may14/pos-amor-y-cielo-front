import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarTickets, cancelarTicket, historialTickets } from '../api/tickets'
import type { TicketResponse } from '../types/api'
import Spinner from '../components/Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

const hoy = () => new Date().toISOString().slice(0, 10)

type Vista = 'abiertas' | 'historial'

export default function TicketsPage() {
  const navigate = useNavigate()
  const [vista, setVista] = useState<Vista>('abiertas')

  // ── Abiertas ────────────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<TicketResponse[]>([])
  const [loadingAbiertas, setLoadingAbiertas] = useState(true)
  const [errorAbiertas, setErrorAbiertas] = useState('')
  const [cancelando, setCancelando] = useState<number | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<TicketResponse | null>(null)

  const cargarAbiertas = useCallback(async () => {
    try {
      setTickets(await listarTickets('ABIERTO'))
      setErrorAbiertas('')
    } catch (e: unknown) {
      setErrorAbiertas(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoadingAbiertas(false)
    }
  }, [])

  useEffect(() => {
    cargarAbiertas()
    const id = setInterval(cargarAbiertas, 30000)
    return () => clearInterval(id)
  }, [cargarAbiertas])

  const handleCancelar = async () => {
    if (!confirmCancel) return
    setCancelando(confirmCancel.id)
    try {
      await cancelarTicket(confirmCancel.id)
      setTickets((prev) => prev.filter((t) => t.id !== confirmCancel.id))
      setConfirmCancel(null)
    } catch (e: unknown) {
      setErrorAbiertas(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCancelando(null)
    }
  }

  // ── Historial ────────────────────────────────────────────────────────────────
  const [historial, setHistorial] = useState<TicketResponse[]>([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState('')
  const [desde, setDesde] = useState(hoy())
  const [hasta, setHasta] = useState(hoy())

  const cargarHistorial = useCallback(async (d: string, h: string) => {
    setLoadingHistorial(true)
    setErrorHistorial('')
    try {
      setHistorial(await historialTickets(d, h))
    } catch (e: unknown) {
      setErrorHistorial(e instanceof Error ? e.message : 'Error al cargar historial')
    } finally {
      setLoadingHistorial(false)
    }
  }, [])

  useEffect(() => {
    if (vista === 'historial') cargarHistorial(desde, hasta)
  }, [vista, cargarHistorial, desde, hasta])

  const cobradas = historial.filter((t) => t.estado === 'COBRADO')
  const canceladas = historial.filter((t) => t.estado === 'CANCELADO')

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold text-stone-800">Comandas</h1>
          <div className="flex gap-1 bg-surface-muted rounded-lg p-1">
            {(['abiertas', 'historial'] as Vista[]).map((v) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  vista === v
                    ? 'bg-white text-stone-800 shadow-sm'
                    : 'text-stone-400 hover:text-stone-600'
                }`}
              >
                {v === 'abiertas' ? 'Abiertas' : 'Historial'}
                {v === 'abiertas' && tickets.length > 0 && (
                  <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                    {tickets.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        {vista === 'abiertas' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setLoadingAbiertas(true); cargarAbiertas() }}
              className="p-2 text-stone-400 hover:text-forest hover:bg-surface-muted rounded-lg transition-colors"
              title="Actualizar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <button onClick={() => navigate('/pos')} className="btn-primary py-2 px-4 text-sm">
              + Nueva orden
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {vista === 'abiertas' ? (
          <>
            {errorAbiertas && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{errorAbiertas}</div>
            )}
            {loadingAbiertas ? (
              <div className="flex items-center justify-center h-40">
                <Spinner className="w-8 h-8 text-forest" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-stone-300 gap-4">
                <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                </svg>
                <div className="text-center">
                  <p className="text-stone-400 font-medium">Sin comandas abiertas</p>
                  <p className="text-stone-300 text-sm mt-1">Crea una nueva orden desde la caja</p>
                </div>
                <button onClick={() => navigate('/pos')} className="btn-primary py-2 px-5 text-sm mt-2">
                  Ir a caja
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {tickets.map((ticket) => (
                  <TicketCardAbierta
                    key={ticket.id}
                    ticket={ticket}
                    onCargar={(t) => navigate('/pos', { state: { ticketId: t.id } })}
                    onCancelar={(t) => setConfirmCancel(t)}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Filtros de fecha */}
            <div className="flex items-end gap-3 mb-6 flex-wrap">
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Desde</label>
                <input
                  type="date"
                  value={desde}
                  max={hasta}
                  onChange={(e) => setDesde(e.target.value)}
                  className="input text-sm py-2"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-stone-500 block mb-1">Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  min={desde}
                  max={hoy()}
                  onChange={(e) => setHasta(e.target.value)}
                  className="input text-sm py-2"
                />
              </div>
              <button
                onClick={() => cargarHistorial(desde, hasta)}
                className="btn-primary py-2 px-4 text-sm"
                disabled={loadingHistorial}
              >
                {loadingHistorial ? <Spinner className="w-4 h-4 text-cream" /> : 'Buscar'}
              </button>
              {historial.length > 0 && (
                <p className="text-sm text-stone-400 self-center">
                  {cobradas.length} cobrada{cobradas.length !== 1 ? 's' : ''} · {canceladas.length} cancelada{canceladas.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>

            {errorHistorial && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{errorHistorial}</div>
            )}

            {loadingHistorial ? (
              <div className="flex items-center justify-center h-40">
                <Spinner className="w-8 h-8 text-forest" />
              </div>
            ) : historial.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-stone-300 gap-2">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <p className="text-stone-400">Sin comandas en este rango de fechas</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {historial.map((ticket) => (
                  <TicketCardHistorial key={ticket.id} ticket={ticket} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm cancel modal */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-stone-800 mb-2">¿Cancelar comanda?</h3>
            <p className="text-sm text-stone-500 mb-1">
              Ticket #{confirmCancel.id} - {fmtHora(confirmCancel.creadoEn)}
              {confirmCancel.nombre ? ` · ${confirmCancel.nombre}` : ''}
            </p>
            <p className="text-sm text-stone-400 mb-5">
              {confirmCancel.items.length} ítem{confirmCancel.items.length !== 1 ? 's' : ''} · {fmt(confirmCancel.totalEstimado)}
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-5">
              El inventario no se verá afectado — esta comanda aún no se cobró.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancel(null)}
                className="btn-secondary flex-1"
                disabled={cancelando !== null}
              >
                Mantener
              </button>
              <button
                onClick={handleCancelar}
                disabled={cancelando !== null}
                className="flex-1 py-2 px-4 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {cancelando !== null && <Spinner className="w-4 h-4 text-white" />}
                Cancelar comanda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tarjeta para comandas abiertas ───────────────────────────────────────────

function TicketCardAbierta({
  ticket,
  onCargar,
  onCancelar,
}: {
  ticket: TicketResponse
  onCargar: (t: TicketResponse) => void
  onCancelar: (t: TicketResponse) => void
}) {
  const totalItems = ticket.items.reduce((s, i) => s + i.cantidad, 0)

  return (
    <div className="bg-white border border-stone-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-stone-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-700 truncate">
              Ticket #{ticket.id} - {fmtHora(ticket.creadoEn)}
            </p>
            {ticket.nombre && (
              <p className="text-xs text-stone-500 truncate mt-0.5">{ticket.nombre}</p>
            )}
          </div>
          <span className="flex-shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            {totalItems} ítem{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 flex-1 space-y-1.5">
        {ticket.items.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-stone-500 truncate">
              <span className="font-medium text-stone-700">{item.cantidad}×</span> {item.nombreProducto}
            </span>
            <span className="flex-shrink-0 text-stone-400">{fmt(item.precioUnitario * item.cantidad)}</span>
          </div>
        ))}
        {ticket.items.length > 4 && (
          <p className="text-xs text-stone-300 italic">+{ticket.items.length - 4} más…</p>
        )}
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-stone-50 space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-stone-400">Total estimado</span>
          <span className="text-base font-bold text-stone-800">{fmt(ticket.totalEstimado)}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onCancelar(ticket)}
            className="p-2 rounded-xl border border-stone-200 text-stone-400 hover:text-red-500 hover:border-red-200 transition-colors"
            title="Cancelar comanda"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
          <button
            onClick={() => onCargar(ticket)}
            className="btn-primary flex-1 py-2 text-sm flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
            Cargar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta para historial (solo lectura) ────────────────────────────────────

function TicketCardHistorial({ ticket }: { ticket: TicketResponse }) {
  const totalItems = ticket.items.reduce((s, i) => s + i.cantidad, 0)
  const esCobrado = ticket.estado === 'COBRADO'

  return (
    <div className={`bg-white border rounded-2xl shadow-sm flex flex-col ${
      esCobrado ? 'border-stone-100' : 'border-red-100 opacity-75'
    }`}>
      <div className="px-4 pt-4 pb-3 border-b border-stone-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-stone-700 truncate">
              Ticket #{ticket.id} - {fmtHora(ticket.creadoEn)}
            </p>
            {ticket.nombre && (
              <p className="text-xs text-stone-500 truncate mt-0.5">{ticket.nombre}</p>
            )}
          </div>
          <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium border ${
            esCobrado
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-red-50 text-red-600 border-red-200'
          }`}>
            {esCobrado ? 'Cobrado' : 'Cancelado'}
          </span>
        </div>
        {ticket.cerradoEn && (
          <p className="text-xs text-stone-300 mt-1">
            {esCobrado ? 'Cobrado' : 'Cancelado'} a las {fmtHora(ticket.cerradoEn)}
          </p>
        )}
      </div>

      <div className="px-4 py-3 flex-1 space-y-1.5">
        {ticket.items.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-stone-500 truncate">
              <span className="font-medium text-stone-700">{item.cantidad}×</span> {item.nombreProducto}
            </span>
            <span className="flex-shrink-0 text-stone-400">{fmt(item.precioUnitario * item.cantidad)}</span>
          </div>
        ))}
        {ticket.items.length > 4 && (
          <p className="text-xs text-stone-300 italic">+{ticket.items.length - 4} más…</p>
        )}
        {ticket.items.length === 0 && (
          <p className="text-xs text-stone-300 italic">Sin ítems registrados</p>
        )}
      </div>

      <div className="px-4 pb-4 pt-3 border-t border-stone-50 flex items-baseline justify-between">
        <span className="text-xs text-stone-400">{totalItems} ítem{totalItems !== 1 ? 's' : ''}</span>
        <span className={`text-base font-bold ${esCobrado ? 'text-stone-800' : 'text-stone-400 line-through'}`}>
          {fmt(ticket.totalEstimado)}
        </span>
      </div>
    </div>
  )
}
