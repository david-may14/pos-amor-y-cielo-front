import { useEffect, useRef, useState } from 'react'

interface Props {
  valor: string
  onChange: (v: string) => void
  longitud?: number
  disabled?: boolean
}

/**
 * Teclado numérico para el PIN.
 *
 * En la barra se usa con el dedo sobre la tablet, que es para lo que se hizo.
 * Pero desde una computadora lo natural es teclear, y al no escuchar el teclado
 * físico obligaba a picar los seis dígitos con el ratón. Ahora acepta las dos
 * cosas: los botones siguen igual y además responde a las teclas.
 */
export default function TecladoPin({ valor, onChange, longitud = 6, disabled = false }: Props) {
  // El valor entra por props y cambia con cada pulsación. Con una referencia,
  // el listener se registra una sola vez en vez de volver a engancharse en cada
  // dígito —lo que puede perder una tecla si se escribe rápido.
  const estado = useRef({ valor, longitud, disabled, onChange })
  estado.current = { valor, longitud, disabled, onChange }

  const [ultimaTecla, setUltimaTecla] = useState<string | null>(null)

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      const { valor, longitud, disabled, onChange } = estado.current
      if (disabled) return

      // Si alguien está escribiendo en un campo, el teclado es suyo.
      const destino = e.target as HTMLElement | null
      if (destino && (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA'
              || destino.isContentEditable)) return

      // Con modificadores son atajos del navegador, no dígitos del PIN.
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (/^[0-9]$/.test(e.key)) {
        if (valor.length >= longitud) return
        e.preventDefault()
        onChange(valor + e.key)
        setUltimaTecla(e.key)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        // Backspace en una página sin campos hace retroceder en el historial
        // en algunos navegadores, que aquí sacaría de la pantalla de desbloqueo.
        e.preventDefault()
        if (!valor) return
        onChange(valor.slice(0, -1))
        setUltimaTecla('borrar')
      }
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  // Destello breve en la tecla pulsada: sin él, teclear no da ninguna señal de
  // que el teclado esté haciendo algo más allá de los puntos de progreso.
  useEffect(() => {
    if (!ultimaTecla) return
    const id = setTimeout(() => setUltimaTecla(null), 120)
    return () => clearTimeout(id)
  }, [ultimaTecla])

  const pulsar = (d: string) => {
    if (disabled || valor.length >= longitud) return
    onChange(valor + d)
  }
  const borrar = () => {
    if (disabled) return
    onChange(valor.slice(0, -1))
  }

  const claseTecla = (id: string) =>
    `py-4 text-xl font-medium text-stone-700 border rounded-xl transition-all disabled:opacity-50 ${
      ultimaTecla === id
        ? 'bg-stone-100 border-stone-300 scale-95'
        : 'bg-white border-stone-200 hover:bg-stone-50 active:scale-95'
    }`

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
            className={claseTecla(d)}
          >
            {d}
          </button>
        ))}
        <span />
        <button
          type="button"
          onClick={() => pulsar('0')}
          disabled={disabled}
          className={claseTecla('0')}
        >
          0
        </button>
        <button
          type="button"
          onClick={borrar}
          disabled={disabled}
          aria-label="Borrar"
          className={`py-4 flex items-center justify-center text-stone-500 border rounded-xl transition-all disabled:opacity-50 ${
            ultimaTecla === 'borrar'
              ? 'bg-stone-100 border-stone-300 scale-95'
              : 'bg-white border-stone-200 hover:bg-stone-50 active:scale-95'
          }`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9.75 14.25 12m0 0 2.25 2.25M14.25 12l2.25-2.25M14.25 12 12 14.25m-2.58 4.92-6.374-6.375a1.125 1.125 0 0 1 0-1.59L9.42 4.83c.21-.211.497-.33.795-.33H19.5a2.25 2.25 0 0 1 2.25 2.25v10.5a2.25 2.25 0 0 1-2.25 2.25h-9.284c-.298 0-.585-.119-.795-.33Z" />
          </svg>
        </button>
      </div>

      {/* Solo donde hay puntero fino —ratón o trackpad—, que es donde hay
          teclado físico. En la tablet sería una línea que estorba. */}
      <p className="hidden [@media(pointer:fine)]:block text-center text-xs text-stone-400">
        También puedes escribirlo con el teclado
      </p>
    </div>
  )
}
