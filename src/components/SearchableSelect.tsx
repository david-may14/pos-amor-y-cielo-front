import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SearchableSelect({ options, value, onChange, placeholder = 'Seleccionar…', className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)
  const filtered = options.filter((o) => o.label.toLowerCase().includes(busqueda.toLowerCase()))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (triggerRef.current && !triggerRef.current.contains(target)) {
        // Check if click is inside the portal dropdown
        const portal = document.getElementById('searchable-select-portal')
        if (portal && portal.contains(target)) return
        setOpen(false)
        setBusqueda('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleOpen = () => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const dropdownHeight = 280

    if (spaceBelow >= dropdownHeight) {
      setDropdownStyle({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    } else {
      setDropdownStyle({
        top: rect.top + window.scrollY - dropdownHeight - 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      })
    }

    setOpen(true)
    setBusqueda('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleSelect = (val: string) => {
    onChange(val)
    setOpen(false)
    setBusqueda('')
  }

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        className="input w-full text-left flex items-center justify-between gap-2"
      >
        <span className={selected ? 'text-stone-800 truncate' : 'text-stone-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {open && createPortal(
        <div
          id="searchable-select-portal"
          style={{ position: 'absolute', zIndex: 9999, ...dropdownStyle }}
          className="bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="p-2 border-b border-stone-100">
            <input
              ref={inputRef}
              className="input w-full text-sm"
              placeholder="Buscar…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setBusqueda('') }
                if (e.key === 'Enter' && filtered.length === 1) handleSelect(filtered[0].value)
              }}
            />
          </div>
          <ul className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-stone-400 text-center">Sin resultados</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o.value}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(o.value) }}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-surface-muted transition-colors ${
                    o.value === value ? 'text-forest font-medium bg-forest/5' : 'text-stone-700'
                  }`}
                >
                  {o.label}
                </li>
              ))
            )}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}
