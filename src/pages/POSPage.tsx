import { useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { listarProductos, listarModificadoresProducto } from '../api/productos'
import { listarCategorias } from '../api/categorias'
import { crearVenta } from '../api/ventas'
import { getDescuentoAplicable, listarDescuentos, listarDescuentosTicket } from '../api/descuentos'
import { detalleTicket, crearTicket, actualizarTicket, cobrarTicket, listarTickets } from '../api/tickets'
import type {
  ProductoDTO, Categoria, VentaResponse, MetodoPago, ModificadorGrupo, DescuentoView,
  TicketResponse, TicketItemRequest,
} from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'
import SplitCuentaModal from '../components/SplitCuentaModal'

interface CartMod {
  opcionId: number
  nombre: string
  precioExtra: number
}

interface CartDiscount {
  descuentoId: number
  nombre: string
  tipo: 'PORCENTAJE' | 'FIJO'
  valor: number
}

interface CartItem {
  lineId: string
  productoId: number
  nombre: string
  precioUnitario: number // base + mods
  cantidad: number
  notas: string
  mods: CartMod[]
  descuento: CartDiscount | null
}

interface ModModal {
  producto: ProductoDTO
  grupos: ModificadorGrupo[]
  seleccion: Record<number, number[]>
  descuentoAplicable: DescuentoView | null
  descuentoActivo: boolean
  cantidad: number
}

const METODOS: MetodoPago[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })

const calcDescuentoMonto = (d: CartDiscount | DescuentoView, base: number): number => {
  if (d.tipo === 'PORCENTAJE') return Math.round(base * d.valor) / 100
  return Math.min(typeof (d as CartDiscount).descuentoId !== 'undefined' ? (d as CartDiscount).valor : (d as DescuentoView).valor, base)
}

const descuentoMontoItem = (item: CartItem): number => {
  if (!item.descuento) return 0
  const subtotal = item.precioUnitario * item.cantidad
  return item.descuento.tipo === 'PORCENTAJE'
    ? subtotal * item.descuento.valor / 100
    : Math.min(item.descuento.valor, subtotal)
}

const fmtDescuento = (d: DescuentoView | CartDiscount) =>
  d.tipo === 'PORCENTAJE' ? `${d.valor}%` : fmt(d.valor)

export default function POSPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [productos, setProductos] = useState<ProductoDTO[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todos')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO')
  const [propina, setPropina] = useState('')
  const [propinaCustom, setPropinaCustom] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ventaExitosa, setVentaExitosa] = useState<VentaResponse | null>(null)
  const [showSplit, setShowSplit] = useState(false)
  const [splitResults, setSplitResults] = useState<VentaResponse[] | null>(null)
  const [expandedNotas, setExpandedNotas] = useState<Set<string>>(new Set())

  // Ticket activo (modo edición)
  const [ticketActivo, setTicketActivo] = useState<TicketResponse | null>(null)
  const [showGuardarTicket, setShowGuardarTicket] = useState(false)
  const [nombreTicketInput, setNombreTicketInput] = useState('')
  const [savingTicket, setSavingTicket] = useState(false)

  // Panel de comandas abiertas
  const [showTicketsPanel, setShowTicketsPanel] = useState(false)
  const [ticketsList, setTicketsList] = useState<TicketResponse[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  const [loadingMods, setLoadingMods] = useState<Set<number>>(new Set())
  const [modModal, setModModal] = useState<ModModal | null>(null)
  const [modError, setModError] = useState('')

  // Descuentos para el ticket completo
  const [descuentosTicket, setDescuentosTicket] = useState<DescuentoView[]>([])
  const [descuentoTicket, setDescuentoTicket] = useState<DescuentoView | null>(null)

  // Búsqueda y cambio
  const [busqueda, setBusqueda] = useState('')
  const [montoRecibido, setMontoRecibido] = useState('')

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats, dticket] = await Promise.all([
        listarProductos(),
        listarCategorias(),
        listarDescuentosTicket().catch(() => [] as DescuentoView[]),
      ])
      setProductos(prods)
      setCategorias(cats.sort((a, b) => a.orden - b.orden))
      setDescuentosTicket(dticket)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Hidratar ticket desde el state de navegación
  const hidratarTicket = useCallback(async (ticketId: number) => {
    try {
      const [t, descuentos] = await Promise.all([
        detalleTicket(ticketId),
        listarDescuentos().catch(() => [] as DescuentoView[]),
      ])
      const descById = new Map(descuentos.map(d => [d.id, d]))
      const items: CartItem[] = t.items.map((ti, idx) => ({
        lineId: `tk-${t.id}-${ti.id}-${idx}`,
        productoId: ti.productoId,
        nombre: ti.nombreProducto,
        precioUnitario: ti.precioUnitario,
        cantidad: ti.cantidad,
        notas: ti.notas ?? '',
        mods: ti.modificadores.map(m => ({ opcionId: m.opcionId, nombre: m.nombre, precioExtra: m.precioExtra })),
        descuento: ti.descuentoId
          ? (() => {
              const d = descById.get(ti.descuentoId!)
              return d ? { descuentoId: d.id, nombre: d.nombre, tipo: d.tipo, valor: d.valor } : null
            })()
          : null,
      }))
      setCart(items)
      setTicketActivo(t)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el ticket')
    }
  }, [])

  useEffect(() => {
    const ticketId = (location.state as { ticketId?: number } | null)?.ticketId
    if (ticketId) {
      hidratarTicket(ticketId)
      // limpiar el state para que un refresh no recargue
      navigate(location.pathname, { replace: true })
    }
  }, [location, navigate, hidratarTicket])

  const cartToTicketItems = (): TicketItemRequest[] => cart.map(i => ({
    productoId: i.productoId,
    nombreProducto: i.nombre,
    cantidad: i.cantidad,
    precioUnitario: i.precioUnitario,
    notas: i.notas || null,
    modificadores: i.mods.map(m => ({ opcionId: m.opcionId, nombre: m.nombre, precioExtra: m.precioExtra })),
    descuentoId: i.descuento?.descuentoId ?? null,
  }))

  const abrirGuardarTicket = () => {
    setNombreTicketInput(ticketActivo?.nombre ?? '')
    setShowGuardarTicket(true)
  }

  const handleGuardarTicket = async () => {
    if (cart.length === 0) return
    setSavingTicket(true)
    setError('')
    try {
      const payload = { nombre: nombreTicketInput.trim() || null, items: cartToTicketItems() }
      if (ticketActivo) {
        const t = await actualizarTicket(ticketActivo.id, payload)
        setTicketActivo(t)
      } else {
        await crearTicket(payload)
        clearCart()
        setTicketActivo(null)
      }
      setShowGuardarTicket(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar el ticket')
    } finally {
      setSavingTicket(false)
    }
  }

  const salirEdicionTicket = () => {
    setTicketActivo(null)
    clearCart()
  }

  const abrirTicketsPanel = async () => {
    setShowTicketsPanel(true)
    setLoadingTickets(true)
    try {
      setTicketsList(await listarTickets('ABIERTO'))
    } catch {
      // silencioso — panel igual se abre
    } finally {
      setLoadingTickets(false)
    }
  }

  const addLine = (producto: ProductoDTO, mods: CartMod[], descuento: CartDiscount | null, cantidad: number) => {
    const precioUnitario = producto.precioVenta + mods.reduce((s, m) => s + m.precioExtra, 0)
    // Sin mods, sin descuento y cantidad 1: acumula en línea existente idéntica
    if (mods.length === 0 && descuento === null && cantidad === 1) {
      const existing = cart.find((i) => i.productoId === producto.id && i.mods.length === 0 && i.descuento === null)
      if (existing) {
        setCart((prev) => prev.map((i) =>
          i.lineId === existing.lineId ? { ...i, cantidad: i.cantidad + 1 } : i
        ))
        return
      }
    }
    setCart((prev) => [...prev, {
      lineId: `${producto.id}-${Date.now()}`,
      productoId: producto.id,
      nombre: producto.nombre,
      precioUnitario,
      cantidad,
      notas: '',
      mods,
      descuento,
    }])
  }

  const handleProductoClick = async (producto: ProductoDTO) => {
    setLoadingMods((prev) => new Set(prev).add(producto.id))
    try {
      const [grupos, descuentoAplicable] = await Promise.all([
        listarModificadoresProducto(producto.id),
        getDescuentoAplicable(producto.id).catch(() => null),
      ])
      setModModal({ producto, grupos, seleccion: {}, descuentoAplicable, descuentoActivo: !!descuentoAplicable, cantidad: 1 })
      setModError('')
    } catch {
      addLine(producto, [], null, 1)
    } finally {
      setLoadingMods((prev) => { const s = new Set(prev); s.delete(producto.id); return s })
    }
  }

  const toggleOpcion = (grupoId: number, opcionId: number, max: number | null) => {
    setModModal((prev) => {
      if (!prev) return prev
      const current = prev.seleccion[grupoId] ?? []
      let next: number[]
      if (max === 1) {
        next = current.includes(opcionId) ? [] : [opcionId]
      } else {
        if (current.includes(opcionId)) {
          next = current.filter((id) => id !== opcionId)
        } else {
          if (max !== null && current.length >= max) return prev
          next = [...current, opcionId]
        }
      }
      return { ...prev, seleccion: { ...prev.seleccion, [grupoId]: next } }
    })
  }

  const confirmarMods = () => {
    if (!modModal) return
    setModError('')
    for (const grupo of modModal.grupos) {
      const count = (modModal.seleccion[grupo.id] ?? []).length
      if (count < grupo.seleccionMin) {
        const s = grupo.seleccionMin > 1 ? 'opciones' : 'opción'
        setModError(`"${grupo.nombre}": selecciona al menos ${grupo.seleccionMin} ${s}`)
        return
      }
    }
    const mods: CartMod[] = []
    for (const grupo of modModal.grupos) {
      for (const id of modModal.seleccion[grupo.id] ?? []) {
        const op = grupo.opciones.find((o) => o.id === id)
        if (op) mods.push({ opcionId: op.id, nombre: op.nombre, precioExtra: op.precioExtra })
      }
    }
    const descuento: CartDiscount | null =
      modModal.descuentoActivo && modModal.descuentoAplicable
        ? {
            descuentoId: modModal.descuentoAplicable.id,
            nombre: modModal.descuentoAplicable.nombre,
            tipo: modModal.descuentoAplicable.tipo,
            valor: modModal.descuentoAplicable.valor,
          }
        : null
    addLine(modModal.producto, mods, descuento, modModal.cantidad)
    setModModal(null)
  }

  const updateCantidad = (lineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.lineId === lineId ? { ...i, cantidad: i.cantidad + delta } : i)
        .filter((i) => i.cantidad > 0)
    )
  }

  const updateNotas = (lineId: string, notas: string) => {
    setCart((prev) => prev.map((i) => i.lineId === lineId ? { ...i, notas } : i))
  }

  const toggleNotas = (lineId: string) => {
    setExpandedNotas((prev) => {
      const next = new Set(prev)
      next.has(lineId) ? next.delete(lineId) : next.add(lineId)
      return next
    })
  }

  const removeLine = (lineId: string) => {
    setCart((prev) => prev.filter((i) => i.lineId !== lineId))
    setExpandedNotas((prev) => { const next = new Set(prev); next.delete(lineId); return next })
  }

  const clearCart = () => {
    setCart([])
    setExpandedNotas(new Set())
    setDescuentoTicket(null)
    setMontoRecibido('')
    setPropina('')
    setPropinaCustom(false)
  }

  // Totales
  const subtotalItems = cart.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0)
  const totalDescuentosItems = cart.reduce((sum, i) => sum + descuentoMontoItem(i), 0)
  const subtotalConDesc = subtotalItems - totalDescuentosItems
  const descuentoTicketMonto = descuentoTicket
    ? (descuentoTicket.tipo === 'PORCENTAJE'
        ? subtotalConDesc * descuentoTicket.valor / 100
        : Math.min(descuentoTicket.valor, subtotalConDesc))
    : 0
  const total = Math.max(0, subtotalConDesc - descuentoTicketMonto)
  const propinaNum = parseFloat(propina) || 0
  const totalConPropina = total + propinaNum

  const handleCobrar = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      let venta: VentaResponse
      if (ticketActivo) {
        // Sincronizar items por si fueron modificados, luego cobrar
        await actualizarTicket(ticketActivo.id, {
          nombre: ticketActivo.nombre,
          items: cartToTicketItems(),
        })
        venta = await cobrarTicket(ticketActivo.id, {
          metodoPago,
          descuentoTicketId: descuentoTicket?.id ?? null,
          propina: propinaNum > 0 ? propinaNum : 0,
        })
        setTicketActivo(null)
      } else {
        const items = cart.map((i) => ({
          productoId: i.productoId,
          cantidad: i.cantidad,
          ...(i.notas ? { notas: i.notas } : {}),
          ...(i.mods.length > 0 ? { modificadorOpcionIds: i.mods.map((m) => m.opcionId) } : {}),
          ...(i.descuento ? { descuentoId: i.descuento.descuentoId } : {}),
        }))
        venta = await crearVenta(items, metodoPago, descuentoTicket?.id ?? null, propinaNum > 0 ? propinaNum : undefined)
      }
      setVentaExitosa(venta)
      clearCart()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar la venta')
    } finally {
      setSubmitting(false)
    }
  }

  const cambio = (() => {
    if (metodoPago !== 'EFECTIVO' || !montoRecibido) return null
    const monto = parseFloat(montoRecibido)
    if (isNaN(monto)) return null
    return monto - totalConPropina
  })()

  const billetesRapidos = (() => {
    if (total <= 0) return []
    const step = total < 100 ? 50 : 100
    const start = Math.ceil((total + 0.01) / step) * step
    return Array.from({ length: 4 }, (_, i) => start + step * i).filter((v) => v <= 2000)
  })()

  const filteredProductos = productos
    .filter((p) => p.disponible)
    .filter((p) => selectedCategoria === 'Todos' || p.categoria === selectedCategoria)
    .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner className="w-8 h-8 text-forest" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ── Productos ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-stone-100 px-4 flex gap-1 overflow-x-auto">
          {['Todos', ...categorias.map((c) => c.nombre)].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoria(cat)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                selectedCategoria === cat
                  ? 'border-forest text-forest'
                  : 'border-transparent text-stone-400 hover:text-stone-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-shrink-0 px-4 pt-3 pb-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              className="input pl-9 text-sm py-2"
              placeholder="Buscar producto…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-2">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
          )}
          {filteredProductos.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-stone-400 text-sm">
              Sin productos en esta categoría
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filteredProductos.map((p) => {
                const cantEnCart = cart.filter((i) => i.productoId === p.id).reduce((s, i) => s + i.cantidad, 0)
                const isLoadingMod = loadingMods.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => handleProductoClick(p)}
                    disabled={isLoadingMod}
                    className={`card text-left p-4 hover:shadow-md hover:border-forest/30 transition-all active:scale-95 ${
                      cantEnCart > 0 ? 'ring-2 ring-forest/40 border-forest/20' : ''
                    } ${isLoadingMod ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    {isLoadingMod ? (
                      <Spinner className="w-4 h-4 text-forest mb-2" />
                    ) : cantEnCart > 0 ? (
                      <span className="inline-flex items-center justify-center bg-forest text-cream text-xs font-bold w-5 h-5 rounded-full mb-2">
                        {cantEnCart}
                      </span>
                    ) : null}
                    <p className="font-medium text-stone-800 text-sm leading-snug">{p.nombre}</p>
                    {p.categoria && <p className="text-xs text-stone-400 mt-0.5">{p.categoria}</p>}
                    <p className="text-forest font-semibold text-sm mt-2">{fmt(p.precioVenta)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Carrito ── */}
      <aside className="w-80 flex-shrink-0 bg-white border-l border-stone-100 flex flex-col relative">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800">{ticketActivo ? 'Ticket abierto' : 'Orden'}</h2>
          <div className="flex items-center gap-2">
            {cart.length > 0 && !ticketActivo && (
              <button onClick={clearCart} className="text-xs text-stone-400 hover:text-red-500 transition-colors">
                Limpiar
              </button>
            )}
            {ticketActivo && (
              <button onClick={salirEdicionTicket} className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
                Salir
              </button>
            )}
            {!ticketActivo && (
              <button
                onClick={abrirTicketsPanel}
                className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                title="Ver comandas abiertas"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
                </svg>
                Comandas
              </button>
            )}
          </div>
        </div>

        {ticketActivo && (
          <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-100 text-xs">
            <p className="font-semibold text-amber-800 truncate">
              Ticket #{ticketActivo.id} - {fmtHora(ticketActivo.creadoEn)}
            </p>
            {ticketActivo.nombre && (
              <p className="text-amber-600 truncate mt-0.5">{ticketActivo.nombre}</p>
            )}
          </div>
        )}

        {/* ── Panel de comandas ── */}
        {showTicketsPanel && (
          <div className="absolute inset-0 bg-white z-10 flex flex-col">
            <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-3">
              <button
                onClick={() => setShowTicketsPanel(false)}
                className="text-stone-400 hover:text-stone-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
                </svg>
              </button>
              <h2 className="font-semibold text-stone-800">Comandas abiertas</h2>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loadingTickets ? (
                <div className="flex items-center justify-center h-24">
                  <Spinner className="w-6 h-6 text-forest" />
                </div>
              ) : ticketsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-stone-300 gap-2 text-sm">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                  </svg>
                  Sin comandas abiertas
                </div>
              ) : (
                <div className="space-y-2">
                  {ticketsList.map((t) => (
                    <div key={t.id} className="bg-surface-muted rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-amber-700">
                            Ticket #{t.id} - {fmtHora(t.creadoEn)}
                          </p>
                          {t.nombre && (
                            <p className="text-xs text-stone-500 truncate">{t.nombre}</p>
                          )}
                        </div>
                        <span className="flex-shrink-0 text-xs text-stone-400">
                          {t.items.reduce((s, i) => s + i.cantidad, 0)} ítems
                        </span>
                      </div>
                      <div className="space-y-0.5 mb-2.5">
                        {t.items.slice(0, 3).map((item) => (
                          <p key={item.id} className="text-xs text-stone-400 truncate">
                            {item.cantidad}× {item.nombreProducto}
                          </p>
                        ))}
                        {t.items.length > 3 && (
                          <p className="text-xs text-stone-300 italic">+{t.items.length - 3} más…</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-stone-700">
                          {fmt(t.totalEstimado)}
                        </span>
                        <button
                          onClick={() => {
                            setShowTicketsPanel(false)
                            hidratarTicket(t.id)
                          }}
                          className="btn-primary py-1.5 px-4 text-xs flex items-center gap-1"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                          </svg>
                          Cargar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-300 gap-3">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              <p className="text-sm">Agrega productos para comenzar</p>
            </div>
          ) : (
            cart.map((item) => {
              const itemDescMonto = descuentoMontoItem(item)
              const itemTotal = item.precioUnitario * item.cantidad - itemDescMonto
              return (
                <div key={item.lineId} className="bg-surface-muted rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-sm font-medium text-stone-800 truncate">{item.nombre}</p>
                        <button
                          onClick={() => removeLine(item.lineId)}
                          className="flex-shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-0.5 transition-colors"
                          title="Eliminar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                      {item.mods.length > 0 && (
                        <div className="mt-0.5">
                          {item.mods.map((m) => (
                            <p key={m.opcionId} className="text-xs text-stone-400">
                              + {m.nombre}{m.precioExtra > 0 ? ` (${fmt(m.precioExtra)})` : ''}
                            </p>
                          ))}
                        </div>
                      )}
                      {item.descuento && (
                        <p className="text-xs text-emerald-600 mt-0.5">
                          − {item.descuento.nombre} ({fmtDescuento(item.descuento)})
                        </p>
                      )}
                      <p className="text-xs text-stone-400 mt-0.5">{fmt(item.precioUnitario)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => updateCantidad(item.lineId, -1)}
                        className="w-7 h-7 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 flex items-center justify-center text-base leading-none"
                      >
                        −
                      </button>
                      <span className="text-sm font-semibold w-4 text-center">{item.cantidad}</span>
                      <button
                        onClick={() => updateCantidad(item.lineId, 1)}
                        className="w-7 h-7 rounded-lg bg-forest text-cream hover:bg-forest-dark flex items-center justify-center text-base leading-none"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <button
                      onClick={() => toggleNotas(item.lineId)}
                      className="text-xs text-stone-400 hover:text-forest transition-colors"
                    >
                      {expandedNotas.has(item.lineId) ? 'Ocultar notas' : 'Agregar notas'}
                    </button>
                    <p className="text-sm font-semibold text-forest">{fmt(itemTotal)}</p>
                  </div>

                  {expandedNotas.has(item.lineId) && (
                    <input
                      type="text"
                      value={item.notas}
                      onChange={(e) => updateNotas(item.lineId, e.target.value)}
                      placeholder="Sin azúcar, leche de avena…"
                      className="input mt-2 text-xs py-1.5"
                    />
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 space-y-3">
          {/* Método de pago */}
          <div>
            <p className="text-xs font-medium text-stone-500 mb-2">Método de pago</p>
            <div className="flex gap-2">
              {METODOS.map((m) => (
                <button
                  key={m}
                  onClick={() => { setMetodoPago(m); setMontoRecibido('') }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    metodoPago === m
                      ? 'bg-forest text-cream border-forest'
                      : 'bg-white text-stone-500 border-stone-200 hover:border-forest/50'
                  }`}
                >
                  {m === 'EFECTIVO' ? 'Efectivo' : m === 'TARJETA' ? 'Tarjeta' : 'Transfer.'}
                </button>
              ))}
            </div>
          </div>

          {/* Monto recibido + cambio (solo efectivo) */}
          {metodoPago === 'EFECTIVO' && cart.length > 0 && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-1.5">Monto recibido</p>

              {/* Botones rápidos */}
              <div className="flex gap-1.5 mb-2">
                {billetesRapidos.map((b) => (
                  <button
                    key={b}
                    onClick={() => setMontoRecibido(String(b))}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      montoRecibido === String(b)
                        ? 'bg-forest text-cream border-forest'
                        : 'bg-white text-stone-600 border-stone-200 hover:border-forest/50'
                    }`}
                  >
                    ${b}
                  </button>
                ))}
              </div>

              {/* Input manual */}
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                <input
                  className="input pl-6 text-sm py-2"
                  type="number"
                  min={0}
                  step="0.5"
                  placeholder={String(Math.ceil(total))}
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                />
              </div>

              {cambio !== null && (
                <div className={`mt-1.5 flex justify-between text-sm font-semibold px-1 ${cambio >= 0 ? 'text-forest' : 'text-red-500'}`}>
                  <span>{cambio >= 0 ? 'Cambio' : 'Falta'}</span>
                  <span>{fmt(Math.abs(cambio))}</span>
                </div>
              )}
            </div>
          )}

          {/* Descuento ticket */}
          {descuentosTicket.length > 0 && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-1">Descuento en ticket</p>
              <select
                className="input text-xs py-1.5"
                value={descuentoTicket?.id ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  setDescuentoTicket(id ? descuentosTicket.find((d) => d.id === id) ?? null : null)
                }}
              >
                <option value="">Sin descuento</option>
                {descuentosTicket.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre} ({fmtDescuento(d)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Propina */}
          {cart.length > 0 && (
            <div>
              <p className="text-xs font-medium text-stone-500 mb-1.5">Propina (opcional)</p>
              <div className="flex gap-1.5">
                {[10, 15, 20].map((pct) => {
                  const monto = Math.round(total * pct / 100)
                  const activo = !propinaCustom && propina === String(monto)
                  return (
                    <button
                      key={pct}
                      onClick={() => { setPropinaCustom(false); setPropina(activo ? '' : String(monto)) }}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        activo
                          ? 'bg-forest text-cream border-forest'
                          : 'bg-white text-stone-600 border-stone-200 hover:border-forest/50'
                      }`}
                    >
                      {pct}%<br />
                      <span className="text-xs opacity-75">{fmt(monto)}</span>
                    </button>
                  )
                })}
                <button
                  onClick={() => { setPropinaCustom(true); setPropina('') }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    propinaCustom
                      ? 'bg-forest text-cream border-forest'
                      : 'bg-white text-stone-600 border-stone-200 hover:border-forest/50'
                  }`}
                >
                  Otra
                </button>
              </div>
              {propinaCustom && (
                <div className="relative mt-2">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">$</span>
                  <input
                    className="input pl-6 text-sm py-2"
                    type="number"
                    min={0}
                    step="1"
                    placeholder="0.00"
                    value={propina}
                    onChange={(e) => setPropina(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {/* Desglose */}
          {(totalDescuentosItems > 0 || descuentoTicketMonto > 0 || propinaNum > 0) && (
            <div className="space-y-1 text-xs text-stone-500">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{fmt(subtotalItems)}</span>
              </div>
              {totalDescuentosItems > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Descuentos en ítems</span>
                  <span>−{fmt(totalDescuentosItems)}</span>
                </div>
              )}
              {descuentoTicketMonto > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>{descuentoTicket!.nombre}</span>
                  <span>−{fmt(descuentoTicketMonto)}</span>
                </div>
              )}
              {propinaNum > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Propina</span>
                  <span>+{fmt(propinaNum)}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-stone-500">{propinaNum > 0 ? 'Total c/propina' : 'Total'}</span>
            <span className="text-2xl font-bold text-stone-900">{fmt(totalConPropina)}</span>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setShowSplit(true); setError('') }}
              disabled={cart.length === 0 || submitting || !!ticketActivo}
              className="flex-shrink-0 py-3 px-3 rounded-xl border-2 border-stone-200 text-stone-500 hover:border-forest hover:text-forest disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={ticketActivo ? 'No disponible en modo ticket' : 'Dividir cuenta'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18" />
              </svg>
            </button>
            <button
              onClick={abrirGuardarTicket}
              disabled={cart.length === 0 || submitting}
              className="flex-shrink-0 py-3 px-3 rounded-xl border-2 border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={ticketActivo ? 'Actualizar ticket' : 'Guardar como ticket'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </button>
            <button
              onClick={handleCobrar}
              disabled={cart.length === 0 || submitting}
              className="btn-primary flex-1 py-3 text-base flex items-center justify-center gap-2"
            >
              {submitting && <Spinner className="w-4 h-4 text-cream" />}
              {submitting ? 'Procesando…' : `Cobrar ${cart.length > 0 ? fmt(totalConPropina) : ''}`}
            </button>
          </div>
        </div>
      </aside>

      {/* ── Modal modificadores + descuento ── */}
      {modModal && (
        <Modal title={modModal.producto.nombre} onClose={() => setModModal(null)} size="sm">
          <div className="space-y-5">
            <p className="text-xs text-stone-400 -mt-2">Selecciona las opciones para este producto</p>

            {modError && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{modError}</p>
            )}

            {modModal.grupos.map((grupo) => {
              const selected = modModal.seleccion[grupo.id] ?? []
              const esRadio = grupo.seleccionMax === 1
              return (
                <div key={grupo.id}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className="text-sm font-semibold text-stone-800">{grupo.nombre}</p>
                    <span className="text-xs text-stone-400">
                      {grupo.seleccionMin > 0 ? `Requerido · mín. ${grupo.seleccionMin}` : 'Opcional'}
                      {grupo.seleccionMax && grupo.seleccionMax > 1 ? ` · máx. ${grupo.seleccionMax}` : ''}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {(grupo.opciones ?? []).filter((o) => o.activo).map((opcion) => {
                      const isSelected = selected.includes(opcion.id)
                      const atMax = !esRadio && grupo.seleccionMax !== null && selected.length >= grupo.seleccionMax && !isSelected
                      return (
                        <button
                          key={opcion.id}
                          type="button"
                          disabled={atMax}
                          onClick={() => toggleOpcion(grupo.id, opcion.id, grupo.seleccionMax)}
                          className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                            isSelected
                              ? 'bg-forest/10 border-forest text-forest'
                              : atMax
                              ? 'bg-stone-50 border-stone-100 text-stone-300 cursor-not-allowed'
                              : 'bg-white border-stone-200 text-stone-700 hover:border-forest/40 hover:bg-surface-muted'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-forest bg-forest' : 'border-stone-300'}`}>
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </span>
                            <span>{opcion.nombre}</span>
                          </div>
                          {opcion.precioExtra > 0 && (
                            <span className="text-xs font-semibold text-forest">+{fmt(opcion.precioExtra)}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {/* Descuento aplicable */}
            {modModal.descuentoAplicable && (
              <div className="border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModModal((p) => p ? { ...p, descuentoActivo: !p.descuentoActivo } : p)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                    modModal.descuentoActivo
                      ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                      : 'bg-white border-stone-200 text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${modModal.descuentoActivo ? 'border-emerald-500 bg-emerald-500' : 'border-stone-300'}`}>
                      {modModal.descuentoActivo && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="font-medium">{modModal.descuentoAplicable.nombre}</span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600">
                    −{fmtDescuento(modModal.descuentoAplicable)}
                  </span>
                </button>
                <p className="text-xs text-stone-400 mt-1 pl-1">Descuento aplicable — desmarca para no aplicar</p>
              </div>
            )}

            {/* Cantidad */}
            <div className="flex items-center justify-between border-t border-stone-100 pt-4">
              <span className="text-sm font-medium text-stone-700">Cantidad</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setModModal((p) => p ? { ...p, cantidad: Math.max(1, p.cantidad - 1) } : p)}
                  className="w-8 h-8 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 flex items-center justify-center text-lg leading-none"
                >
                  −
                </button>
                <span className="text-lg font-semibold text-stone-800 w-6 text-center">{modModal.cantidad}</span>
                <button
                  onClick={() => setModModal((p) => p ? { ...p, cantidad: p.cantidad + 1 } : p)}
                  className="w-8 h-8 rounded-lg bg-forest text-cream hover:bg-forest-dark flex items-center justify-center text-lg leading-none"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setModModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={confirmarMods} className="btn-primary flex-1">
                {modModal.cantidad > 1 ? `Agregar ${modModal.cantidad} al pedido` : 'Agregar al pedido'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Split de cuenta ── */}
      {showSplit && (
        <SplitCuentaModal
          cart={cart}
          onConfirm={(results) => {
            setSplitResults(results)
            setShowSplit(false)
            clearCart()
          }}
          onClose={() => setShowSplit(false)}
        />
      )}

      {/* ── Recibo dividido ── */}
      {splitResults && (
        <Modal title="Cuentas cobradas" onClose={() => setSplitResults(null)} size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-green-800">
                  {splitResults.length} cuenta{splitResults.length !== 1 ? 's' : ''} procesada{splitResults.length !== 1 ? 's' : ''}
                </p>
                <p className="text-sm text-green-600">
                  Total cobrado: {fmt(splitResults.reduce((s, v) => s + v.total + (v.propina ?? 0), 0))}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {splitResults.map((v, idx) => (
                <div key={v.id} className="card px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-stone-800">
                      Cuenta {idx + 1} · #{v.id}
                    </p>
                    <span className="text-xs bg-surface-muted text-stone-600 px-2 py-0.5 rounded-md">
                      {v.metodoPago}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {v.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-xs text-stone-600">
                        <span>{item.cantidad}× {item.nombreProducto}</span>
                        <span>{fmt(item.precioUnitario * item.cantidad)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-forest mt-2 pt-2 border-t border-stone-50">
                    <span>Total</span>
                    <span>{fmt(v.total + (v.propina ?? 0))}</span>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setSplitResults(null)} className="btn-primary w-full py-2.5">
              Nueva venta
            </button>
          </div>
        </Modal>
      )}

      {/* ── Recibo ── */}
      {ventaExitosa && (
        <Modal title="Venta registrada" onClose={() => setVentaExitosa(null)} size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-semibold text-green-800">Venta #{ventaExitosa.id}</p>
                <p className="text-sm text-green-600">{ventaExitosa.metodoPago}</p>
              </div>
            </div>

            <div className="space-y-2">
              {ventaExitosa.items.map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone-600">{item.cantidad}× {item.nombreProducto}</span>
                    <span className="font-medium">{fmt(item.precioUnitario * item.cantidad)}</span>
                  </div>
                  {(item.modificadores ?? []).length > 0 && (
                    <div className="pl-4">
                      {item.modificadores.map((m, j) => (
                        <p key={j} className="text-xs text-stone-400">+ {m.nombre}</p>
                      ))}
                    </div>
                  )}
                  {item.descuentoNombre && item.descuentoMonto != null && (
                    <div className="flex justify-between pl-4 text-xs text-emerald-600">
                      <span>− {item.descuentoNombre}</span>
                      <span>−{fmt(item.descuentoMonto)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {ventaExitosa.descuentoTicketNombre && ventaExitosa.descuentoTicketMonto != null && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>− {ventaExitosa.descuentoTicketNombre}</span>
                <span>−{fmt(ventaExitosa.descuentoTicketMonto)}</span>
              </div>
            )}

            <div className="border-t border-stone-100 pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-forest text-lg">{fmt(ventaExitosa.total)}</span>
            </div>

            <button onClick={() => setVentaExitosa(null)} className="btn-primary w-full py-2.5">
              Nueva venta
            </button>
          </div>
        </Modal>
      )}

      {/* ── Guardar ticket ── */}
      {showGuardarTicket && (
        <Modal
          title={ticketActivo ? 'Actualizar ticket' : 'Guardar ticket'}
          onClose={() => setShowGuardarTicket(false)}
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-stone-500 mb-1.5 block">
                Etiqueta <span className="text-stone-300">(opcional — mesa, nombre)</span>
              </label>
              <input
                type="text"
                value={nombreTicketInput}
                onChange={(e) => setNombreTicketInput(e.target.value)}
                placeholder="Mesa 4, Andrés…"
                autoFocus
                className="input text-sm"
                maxLength={120}
                onKeyDown={(e) => e.key === 'Enter' && handleGuardarTicket()}
              />
            </div>
            <div className="bg-surface-muted rounded-lg px-3 py-2.5 text-xs text-stone-500 flex justify-between">
              <span>{cart.length} ítems · subtotal sin cobrar</span>
              <span className="font-semibold text-stone-700">{fmt(subtotalConDesc)}</span>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setShowGuardarTicket(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button
                onClick={handleGuardarTicket}
                disabled={savingTicket || cart.length === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {savingTicket && <Spinner className="w-4 h-4 text-cream" />}
                {ticketActivo ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
