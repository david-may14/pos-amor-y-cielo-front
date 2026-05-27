import { useEffect, useState } from 'react'

function format(seconds: number): string {
  const m = Math.floor(seconds / 60)
  if (m < 1) return 'recién'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? `hace ${h}h` : `hace ${h}h ${rem}m`
}

export default function ElapsedSince({ iso }: { iso: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  return <>{format(seconds)}</>
}
