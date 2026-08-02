import { useEffect, useState } from 'react'

export interface SelloVersion {
  version: string
  build: string
  commit: string | null
}

/**
 * Lee www/version.json, que el shell de Android escribe al empaquetar. Es el
 * mismo dato con el que se nombra el APK, así que lo que ves aquí identifica
 * exactamente el archivo instalado.
 *
 * Fuera del APK (navegador, `npm run dev`) no existe y devuelve null.
 */
export function useVersionApp(): SelloVersion | null {
  const [sello, setSello] = useState<SelloVersion | null>(null)

  useEffect(() => {
    let vivo = true
    fetch('/version.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d?.version) setSello(d as SelloVersion) })
      .catch(() => { /* en web no hay sello y no pasa nada */ })
    return () => { vivo = false }
  }, [])

  return sello
}
