import { useEffect, useState } from 'react'
import Spinner from './Spinner'

/**
 * Pantalla completa con el logo mientras arranca la app.
 *
 * Es la misma que pinta index.html antes de que cargue el JavaScript, para que
 * el paso de una a otra no se note. Si tarda, avisa que se está esperando al
 * servidor: tras un rato sin uso tarda en despertar, y sin aviso parece que la
 * app se colgó.
 */
export default function PantallaCarga() {
  const [tardando, setTardando] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setTardando(true), 4000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-forest-deep px-6 text-center">
      <img src="/logo-cream.svg" alt="Amor y Cielo" className="w-44 max-w-[60vw]" />
      <Spinner className="w-7 h-7 text-cream" />
      <p className={`text-sm text-cream/70 transition-opacity duration-500 ${tardando ? 'opacity-100' : 'opacity-0'}`}>
        Conectando con el servidor, puede tardar unos segundos…
      </p>
    </div>
  )
}
