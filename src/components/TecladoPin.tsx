interface Props {
  valor: string
  onChange: (v: string) => void
  longitud?: number
  disabled?: boolean
}

/** Teclado numérico táctil: en la caja se usa con el dedo, no con teclado físico. */
export default function TecladoPin({ valor, onChange, longitud = 6, disabled = false }: Props) {
  const pulsar = (d: string) => {
    if (disabled || valor.length >= longitud) return
    onChange(valor + d)
  }
  const borrar = () => {
    if (disabled) return
    onChange(valor.slice(0, -1))
  }

  return (
    <div className="space-y-6">
      {/* Puntos de progreso */}
      <div className="flex justify-center gap-3">
        {Array.from({ length: longitud }).map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full transition-colors ${
              i < valor.length ? 'bg-forest' : 'bg-stone-200'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => pulsar(d)}
            disabled={disabled}
            className="py-4 text-xl font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 active:scale-95 transition-all disabled:opacity-50"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => pulsar('0')}
          disabled={disabled}
          className="py-4 text-xl font-medium text-stone-700 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 active:scale-95 transition-all disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={borrar}
          disabled={disabled}
          aria-label="Borrar"
          className="py-4 flex items-center justify-center text-stone-500 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 active:scale-95 transition-all disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
