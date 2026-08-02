import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Deslizar hacia abajo para recargar.
 *
 * En una tablet es el gesto que la gente prueba por instinto cuando algo no
 * aparece, y sin él la única salida es esperar al siguiente sondeo o reiniciar
 * la app.
 *
 * Los listeners se registran a mano y no con onTouchMove de React porque hay
 * que llamar a preventDefault(): React los engancha en modo pasivo y ahí
 * preventDefault no hace nada, así que el WebView se quedaría con el gesto y
 * recargaría la página entera.
 */

/** Cuánto hay que arrastrar para que suelte la recarga. */
const UMBRAL = 70
/** Tope del arrastre, para que no se despegue media pantalla. */
const MAXIMO = 110
/** El dedo recorre más de lo que baja el contenido: da sensación de resistencia. */
const RESISTENCIA = 0.5

interface Props {
  onRefresh: () => void | Promise<void>
  children: ReactNode
  className?: string
}

export default function PullToRefresh({ onRefresh, children, className = '' }: Props) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [distancia, setDistancia] = useState(0)
  const [refrescando, setRefrescando] = useState(false)

  // Espejos en ref: los listeners nativos se registran una sola vez y verían
  // los valores congelados del primer render si leyeran el estado.
  const distanciaRef = useRef(0)
  const refrescandoRef = useRef(false)
  const inicioY = useRef<number | null>(null)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const mover = (px: number) => {
    distanciaRef.current = px
    setDistancia(px)
  }

  useEffect(() => {
    const el = contenedor.current
    if (!el) return

    const alEmpezar = (e: TouchEvent) => {
      // Solo cuenta si ya se está hasta arriba: si no, el dedo está haciendo
      // scroll normal por la lista y robarle el gesto sería insoportable.
      if (el.scrollTop > 0 || refrescandoRef.current) {
        inicioY.current = null
        return
      }
      inicioY.current = e.touches[0].clientY
    }

    const alMover = (e: TouchEvent) => {
      if (inicioY.current === null) return
      const delta = e.touches[0].clientY - inicioY.current

      if (delta <= 0) {
        // Cambió de idea y sube: se devuelve el gesto al scroll.
        if (distanciaRef.current !== 0) mover(0)
        inicioY.current = null
        return
      }

      e.preventDefault()
      mover(Math.min(MAXIMO, delta * RESISTENCIA))
    }

    const alSoltar = async () => {
      if (inicioY.current === null) return
      inicioY.current = null

      if (distanciaRef.current < UMBRAL) {
        mover(0)
        return
      }

      refrescandoRef.current = true
      setRefrescando(true)
      mover(UMBRAL)
      try {
        await onRefreshRef.current()
      } finally {
        refrescandoRef.current = false
        setRefrescando(false)
        mover(0)
      }
    }

    el.addEventListener('touchstart', alEmpezar, { passive: true })
    el.addEventListener('touchmove', alMover, { passive: false })
    el.addEventListener('touchend', alSoltar)
    el.addEventListener('touchcancel', alSoltar)
    return () => {
      el.removeEventListener('touchstart', alEmpezar)
      el.removeEventListener('touchmove', alMover)
      el.removeEventListener('touchend', alSoltar)
      el.removeEventListener('touchcancel', alSoltar)
    }
  }, [])

  const listo = distancia >= UMBRAL

  return (
    <div
      ref={contenedor}
      className={`relative overflow-y-auto ${className}`}
      // contain corta el rebote propio del WebView, que en Android compite con
      // este gesto y llega a recargar la página.
      style={{ overscrollBehaviorY: 'contain' }}
    >
      <div
        className="absolute inset-x-0 top-0 flex items-end justify-center pointer-events-none z-10"
        style={{ height: distancia, opacity: distancia > 8 ? 1 : 0 }}
      >
        <span className="mb-2 text-xs font-medium text-stone-500 flex items-center gap-2">
          <svg
            className={`w-4 h-4 text-forest ${refrescando ? 'animate-spin' : 'transition-transform'}`}
            style={!refrescando && listo ? { transform: 'rotate(180deg)' } : undefined}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            {refrescando ? (
              <circle className="opacity-30" cx="12" cy="12" r="9" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v14m0 0-5-5m5 5 5-5" />
            )}
            {refrescando && <path strokeLinecap="round" d="M21 12a9 9 0 0 0-9-9" />}
          </svg>
          {refrescando ? 'Actualizando…' : listo ? 'Suelta para actualizar' : 'Desliza para actualizar'}
        </span>
      </div>

      <div
        style={{
          transform: `translateY(${distancia}px)`,
          transition: distancia === 0 ? 'transform 200ms ease-out' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}
