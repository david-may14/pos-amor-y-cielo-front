import { useState, useEffect, useCallback } from 'react'
import { listarProductos } from '../api/productos'
import { listarCategorias } from '../api/categorias'
import { crearVenta } from '../api/ventas'
import type { ProductoDTO, Categoria, VentaResponse, MetodoPago } from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

interface CartItem {
  productoId: number
  nombre: string
  precioUnitario: number
  cantidad: number
  notas: string
}

const METODOS: MetodoPago[] = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA']

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

export default function POSPage() {
  const [productos, setProductos] = useState<ProductoDTO[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedCategoria, setSelectedCategoria] = useState<string>('Todos')
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('EFECTIVO')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ventaExitosa, setVentaExitosa] = useState<VentaResponse | null>(null)
  const [expandedNotas, setExpandedNotas] = useState<Set<number>>(new Set())

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const [prods, cats] = await Promise.all([listarProductos(), listarCategorias()])
      setProductos(prods)
      setCategorias(cats.sort((a, b) => a.orden - b.orden))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const addToCart = (producto: ProductoDTO) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.productoId === producto.id)
      if (existing) {
        return prev.map((i) =>
          i.productoId === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [
        ...prev,
        { productoId: producto.id, nombre: producto.nombre, precioUnitario: producto.precioVenta, cantidad: 1, notas: '' },
      ]
    })
  }

  const updateCantidad = (productoId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.productoId === productoId ? { ...i, cantidad: i.cantidad + delta } : i)
        .filter((i) => i.cantidad > 0)
    )
  }

  const updateNotas = (productoId: number, notas: string) => {
    setCart((prev) => prev.map((i) => i.productoId === productoId ? { ...i, notas } : i))
  }

  const toggleNotas = (productoId: number) => {
    setExpandedNotas((prev) => {
      const next = new Set(prev)
      next.has(productoId) ? next.delete(productoId) : next.add(productoId)
      return next
    })
  }

  const clearCart = () => {
    setCart([])
    setExpandedNotas(new Set())
  }

  const total = cart.reduce((sum, i) => sum + i.precioUnitario * i.cantidad, 0)

  const handleCobrar = async () => {
    if (cart.length === 0) return
    setSubmitting(true)
    setError('')
    try {
      const items = cart.map((i) => ({
        productoId: i.productoId,
        cantidad: i.cantidad,
        ...(i.notas ? { notas: i.notas } : {}),
      }))
      const venta = await crearVenta(items, metodoPago)
      setVentaExitosa(venta)
      clearCart()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar la venta')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProductos =
    selectedCategoria === 'Todos'
      ? productos
      : productos.filter((p) => p.categoria === selectedCategoria)

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
        {/* Category tabs */}
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

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
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
                const inCart = cart.find((i) => i.productoId === p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`card text-left p-4 hover:shadow-md hover:border-forest/30 transition-all active:scale-95 ${
                      inCart ? 'ring-2 ring-forest/40 border-forest/20' : ''
                    }`}
                  >
                    {inCart && (
                      <span className="inline-flex items-center justify-center bg-forest text-cream text-xs font-bold w-5 h-5 rounded-full mb-2">
                        {inCart.cantidad}
                      </span>
                    )}
                    <p className="font-medium text-stone-800 text-sm leading-snug">{p.nombre}</p>
                    {p.categoria && (
                      <p className="text-xs text-stone-400 mt-0.5">{p.categoria}</p>
                    )}
                    <p className="text-forest font-semibold text-sm mt-2">{fmt(p.precioVenta)}</p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Carrito ── */}
      <aside className="w-80 flex-shrink-0 bg-white border-l border-stone-100 flex flex-col">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h2 className="font-semibold text-stone-800">Orden</h2>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-stone-400 hover:text-red-500 transition-colors">
              Limpiar
            </button>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-300 gap-3">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth={1.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              <p className="text-sm">Agrega productos para comenzar</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.productoId} className="bg-surface-muted rounded-xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{item.nombre}</p>
                    <p className="text-xs text-stone-400">{fmt(item.precioUnitario)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => updateCantidad(item.productoId, -1)}
                      className="w-7 h-7 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-100 flex items-center justify-center text-base leading-none"
                    >
                      −
                    </button>
                    <span className="text-sm font-semibold w-4 text-center">{item.cantidad}</span>
                    <button
                      onClick={() => updateCantidad(item.productoId, 1)}
                      className="w-7 h-7 rounded-lg bg-forest text-cream hover:bg-forest-dark flex items-center justify-center text-base leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={() => toggleNotas(item.productoId)}
                    className="text-xs text-stone-400 hover:text-forest transition-colors"
                  >
                    {expandedNotas.has(item.productoId) ? 'Ocultar notas' : 'Agregar notas'}
                  </button>
                  <p className="text-sm font-semibold text-forest">
                    {fmt(item.precioUnitario * item.cantidad)}
                  </p>
                </div>

                {expandedNotas.has(item.productoId) && (
                  <input
                    type="text"
                    value={item.notas}
                    onChange={(e) => updateNotas(item.productoId, e.target.value)}
                    placeholder="Sin azúcar, leche de avena…"
                    className="input mt-2 text-xs py-1.5"
                  />
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-stone-100 space-y-4">
          {/* Payment method */}
          <div>
            <p className="text-xs font-medium text-stone-500 mb-2">Método de pago</p>
            <div className="flex gap-2">
              {METODOS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMetodoPago(m)}
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

          {/* Total */}
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-stone-500">Total</span>
            <span className="text-2xl font-bold text-stone-900">{fmt(total)}</span>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            onClick={handleCobrar}
            disabled={cart.length === 0 || submitting}
            className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
          >
            {submitting && <Spinner className="w-4 h-4 text-cream" />}
            {submitting ? 'Procesando…' : `Cobrar ${cart.length > 0 ? fmt(total) : ''}`}
          </button>
        </div>
      </aside>

      {/* ── Recibo modal ── */}
      {ventaExitosa && (
        <Modal title="Venta registrada" onClose={() => setVentaExitosa(null)} size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-green-50 rounded-xl p-4">
              <span className="text-3xl">✓</span>
              <div>
                <p className="font-semibold text-green-800">Venta #{ventaExitosa.id}</p>
                <p className="text-sm text-green-600">{ventaExitosa.metodoPago}</p>
              </div>
            </div>

            <div className="space-y-2">
              {ventaExitosa.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-stone-600">
                    {item.cantidad}× {item.nombreProducto}
                  </span>
                  <span className="font-medium">{fmt(item.precioUnitario * item.cantidad)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-stone-100 pt-3 flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-forest text-lg">{fmt(ventaExitosa.total)}</span>
            </div>

            <button
              onClick={() => setVentaExitosa(null)}
              className="btn-primary w-full py-2.5"
            >
              Nueva venta
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
