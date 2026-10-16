import { useState, useRef, useMemo } from 'react'
import type { IngredienteBasico } from '../types/api'

interface Props {
  ingredientes: IngredienteBasico[]
  onElegir: (ing: IngredienteBasico) => void
  /** Ingredientes ya agregados: no vuelven a salir en los resultados. */
  excluirIds?: number[]
  placeholder?: string
  autoFocus?: boolean
}

const MAX_RESULTADOS = 8

/**
 * Buscador que agrega, no que selecciona.
 *
 * Un `<select>` —aunque tenga filtro dentro— obliga a abrirlo, buscar, cerrar
 * y repetir por cada renglon. Aqui se escribe una vez y cada Enter deja un
 * renglon nuevo, con el campo listo para el siguiente: el caso real es capturar
 * una factura de varias cosas seguidas.
 *
 * Los resultados muestran el stock actual porque es el dato con el que se
 * decide, y porque hay insumos que solo se distinguen por su presentacion.
 */
export default function BuscadorIngrediente({
  ingredientes, onElegir, excluirIds = [], placeholder = 'Buscar ingrediente…', autoFocus = false,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [resaltado, setResaltado] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return []
    return ingredientes
      .filter((i) => !excluirIds.includes(i.id) && i.nombre.toLowerCase().includes(q))
      .slice(0, MAX_RESULTADOS)
  }, [busqueda, ingredientes, excluirIds])

  const elegir = (ing: IngredienteBasico) => {
    onElegir(ing)
    setBusqueda('')
    setResaltado(0)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
      </svg>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className="input pl-9"
        placeholder={placeholder}
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setResaltado(0) }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setBusqueda(''); return }
          if (resultados.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setResaltado((r) => Math.min(r + 1, resultados.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setResaltado((r) => Math.max(r - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            elegir(resultados[resaltado])
          }
        }}
      />
      {busqueda.trim() && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden max-h-64 overflow-y-auto">
          {resultados.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-stone-400 text-center">
              Sin resultados para "{busqueda.trim()}"
            </li>
          ) : (
            resultados.map((ing, i) => (
              <li
                key={ing.id}
                onMouseDown={(e) => { e.preventDefault(); elegir(ing) }}
                onMouseEnter={() => setResaltado(i)}
                className={`flex items-baseline justify-between gap-3 px-3 py-2.5 text-sm cursor-pointer ${
                  i === resaltado ? 'bg-forest/5' : ''
                }`}
              >
                <span className="font-medium text-stone-700">{ing.nombre}</span>
                <span className="text-xs text-stone-400 shrink-0 tabular-nums">
                  {ing.stockActual} {ing.unidad}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
