import { useState } from 'react'
import IngredientesPage from './IngredientesPage'
import SubrecetasPage from './SubrecetasPage'
import PlantillasPage from './PlantillasPage'

type Tab = 'ingredientes' | 'subrecetas' | 'plantillas'

const TABS: { key: Tab; label: string; desc: string }[] = [
  { key: 'ingredientes', label: 'Ingredientes', desc: 'Materia prima y stock' },
  { key: 'subrecetas',   label: 'Sub-recetas',  desc: 'Elaborados (Cold Brew, cremas…)' },
  { key: 'plantillas',   label: 'Plantillas',   desc: 'Grupos reutilizables por producto' },
]

export default function InsumosPage() {
  const [tab, setTab] = useState<Tab>('ingredientes')
  const [tabKeys, setTabKeys] = useState<Record<Tab, number>>({ ingredientes: 0, subrecetas: 0, plantillas: 0 })

  const handleTab = (key: Tab) => {
    // Re-montar el panel destino para que siempre fetchee datos frescos
    if (key !== tab) {
      setTabKeys((prev) => ({ ...prev, [key]: prev[key] + 1 }))
    }
    setTab(key)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 bg-white border-b border-stone-100 px-6">
        <div className="flex gap-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTab(key)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-forest text-forest'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={tab === 'ingredientes' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
        <IngredientesPage key={tabKeys.ingredientes} />
      </div>
      <div className={tab === 'subrecetas' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
        <SubrecetasPage key={tabKeys.subrecetas} />
      </div>
      <div className={tab === 'plantillas' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
        <PlantillasPage key={tabKeys.plantillas} />
      </div>
    </div>
  )
}
