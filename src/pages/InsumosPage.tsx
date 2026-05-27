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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex-shrink-0 bg-white border-b border-stone-100 px-6">
        <div className="flex gap-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
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

      {/* Panels — siempre montados para preservar estado al cambiar de tab */}
      <div className={tab === 'ingredientes' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
        <IngredientesPage />
      </div>
      <div className={tab === 'subrecetas' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
        <SubrecetasPage />
      </div>
      <div className={tab === 'plantillas' ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'}>
        <PlantillasPage />
      </div>
    </div>
  )
}
