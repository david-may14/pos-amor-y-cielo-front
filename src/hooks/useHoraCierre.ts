import { useEffect, useState } from 'react'

const HORA_CIERRE = 22 // 10:00 pm

function horaActualYucatan(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Merida', hour: 'numeric', hour12: false }).format(new Date()),
  )
}

/** true a partir de las 10 pm hora de Yucatán, sin importar la zona horaria del dispositivo. */
export function useEsHoraDeCierre(): boolean {
  const [esHora, setEsHora] = useState(() => horaActualYucatan() >= HORA_CIERRE)

  useEffect(() => {
    const id = setInterval(() => setEsHora(horaActualYucatan() >= HORA_CIERRE), 60_000)
    return () => clearInterval(id)
  }, [])

  return esHora
}
