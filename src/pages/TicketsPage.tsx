import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { listarTickets, cancelarTicket } from '../api/tickets'
import type { TicketResponse } from '../types/api'
import Spinner from '../components/Spinner'
import ElapsedSince from '../components/ElapsedSince'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export default function TicketsPage() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<TicketResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cancelando, setCancelando] = useState<number | null>(null)
  const [confirmCancel, setConfirmCancel] = useState<TicketResponse | null>(null)

  const cargar = useCallback(async () => {
    try {
      const data = await listarTickets('ABIERTO')
      setTickets(data)
      setError('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar tickets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
    const id = setInterval(cargar, 30000)
    return () => clearInterval(id)
  }, [cargar])

  const handleCargar = (ticket: TicketResponse) => {
    navigate('/pos', { state: { ticketId: ticket.id } })
  }

  const handleCancelar = async () => {
    if (!confirmCancel) return
    setCancelando(confirmCancel.id)
    try {
      await cancelarTicket(confirmCancel.id)
      setTickets((prev) => prev.filter((t) => t.id !== confirmCancel.id))
      setConfirmCancel(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cancelar')
    } finally {
      setCancelando(null)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-stone-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Comandas abiertas</h1>
          <p className="text-xs text-stone-400 mt-0.5">
            {loading ? 'Cargando…' : `${tickets.length} ticket${tickets.length !== 1 ? 's' : ''} abierto${tickets.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); cargar() }}
            className="p-2 text-stone-400 hover:text-forest hover:bg-surface-muted rounded-lg transition-colors"
            title="Actualizar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
          <button
            onClick={() => navigate('/pos')}
            className="btn-primary py-2 px-4 text-sm"
          >
            + Nueva orden
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        )}

        {loading ? (
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
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onCargar={handleCargar}
                onCancelar={(t) => setConfirmCancel(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Confirm cancel modal */}
      {confirmCancel && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-stone-800 mb-2">¿Cancelar comanda?</h3>
            <p className="text-sm text-stone-500 mb-1">
              #{confirmCancel.id}{confirmCancel.nombre ? ` · ${confirmCancel.nombre}` : ''}
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
                {cancelando && <Spinner className="w-4 h-4 text-white" />}
                Cancelar comanda
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TicketCard({
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
      {/* Card header */}
      <div className="px-4 pt-4 pb-3 border-b border-stone-50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-700 truncate">
              #{ticket.id}
              {ticket.nombre && <span className="text-stone-600"> · {ticket.nombre}</span>}
            </p>
            <p className="text-xs text-stone-400 mt-0.5">
              Abierto <ElapsedSince iso={ticket.creadoEn} />
            </p>
          </div>
          <span className="flex-shrink-0 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            {totalItems} ítem{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Items list */}
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
          <p className="text-xs text-stone-300 italic">
            +{ticket.items.length - 4} más…
          </p>
        )}
      </div>

      {/* Footer */}
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
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
            </svg>
            Cargar
          </button>
        </div>
      </div>
    </div>
  )
}
