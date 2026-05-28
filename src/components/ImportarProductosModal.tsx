import { useState, useRef } from 'react'
import { previewImport, confirmarImport } from '../api/productos'
import type { ImportPreviewResult, ImportResult } from '../types/api'
import Modal from './Modal'
import Spinner from './Spinner'

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

interface Props {
  onClose: () => void
  onSuccess: (result: ImportResult) => void
}

export default function ImportarProductosModal({ onClose, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const [open, setOpen] = useState<Set<string>>(new Set(['crear', 'actualizar', 'eliminar']))
  const toggleSection = (k: string) =>
    setOpen((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n })

  const handleFile = async (f: File) => {
    setFile(f)
    setPreview(null)
    setError('')
    setLoadingPreview(true)
    try {
      setPreview(await previewImport(f))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al procesar el archivo')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleConfirmar = async () => {
    if (!file) return
    setConfirming(true)
    setError('')
    try {
      const result = await confirmarImport(file)
      onSuccess(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al aplicar cambios')
    } finally {
      setConfirming(false)
    }
  }

  const hasErrors = !!preview && preview.errores.length > 0
  const hasChanges = !!preview && (
    preview.aCrear.length + preview.aActualizar.length + preview.aEliminar.length > 0
  )

  return (
    <Modal title="Importar productos desde CSV" onClose={onClose} size="lg">
      <div className="space-y-5">
        {/* File picker */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
          className="border-2 border-dashed border-stone-200 rounded-xl px-6 py-8 text-center cursor-pointer hover:border-forest/50 transition-colors"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <svg className="w-8 h-8 text-stone-300 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          {file ? (
            <p className="text-sm font-medium text-stone-700">{file.name}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-stone-600">Arrastra un CSV o haz clic para seleccionar</p>
              <p className="text-xs text-stone-400 mt-1">Columnas: handle, nombre, categoria, precio, costo, disponible</p>
            </>
          )}
        </div>

        {/* Loading */}
        {loadingPreview && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-stone-500">
            <Spinner className="w-5 h-5 text-forest" /> Analizando…
          </div>
        )}

        {/* Error general */}
        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            {/* Errors */}
            {preview.errores.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
                <p className="text-sm font-semibold text-red-700 mb-2">Errores en el CSV ({preview.errores.length})</p>
                <ul className="space-y-1">
                  {preview.errores.map((e, i) => (
                    <li key={i} className="text-xs text-red-600">Fila {e.fila}: {e.mensaje}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Categorías nuevas */}
            {preview.categoriasNuevas.length > 0 && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs font-medium text-stone-500">Categorías nuevas:</span>
                {preview.categoriasNuevas.map((c) => (
                  <span key={c} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">{c}</span>
                ))}
              </div>
            )}

            {/* Sección crear */}
            {preview.aCrear.length > 0 && (
              <div className="border border-emerald-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('crear')}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-emerald-50 text-left"
                >
                  <span className="text-sm font-medium text-emerald-800">
                    Crear {preview.aCrear.length} producto{preview.aCrear.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-emerald-600 text-xs">{open.has('crear') ? '▲' : '▼'}</span>
                </button>
                {open.has('crear') && (
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-stone-100 bg-white">
                      <th className="px-4 py-2 text-left text-stone-400 font-medium">Nombre</th>
                      <th className="px-4 py-2 text-left text-stone-400 font-medium">Categoría</th>
                      <th className="px-4 py-2 text-right text-stone-400 font-medium">Precio</th>
                      <th className="px-4 py-2 text-right text-stone-400 font-medium">Costo</th>
                    </tr></thead>
                    <tbody className="divide-y divide-stone-50 bg-white">
                      {preview.aCrear.map((r, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-stone-700">{r.nombre}</td>
                          <td className="px-4 py-2 text-stone-500">{r.categoria}</td>
                          <td className="px-4 py-2 text-right text-stone-700">{fmt(r.precio)}</td>
                          <td className="px-4 py-2 text-right text-stone-500">{fmt(r.costo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Sección actualizar */}
            {preview.aActualizar.length > 0 && (
              <div className="border border-amber-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('actualizar')}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-amber-50 text-left"
                >
                  <span className="text-sm font-medium text-amber-800">
                    Actualizar {preview.aActualizar.length} producto{preview.aActualizar.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-amber-600 text-xs">{open.has('actualizar') ? '▲' : '▼'}</span>
                </button>
                {open.has('actualizar') && (
                  <div className="divide-y divide-stone-50 bg-white">
                    {preview.aActualizar.map((r, i) => (
                      <div key={i} className="px-4 py-2.5">
                        <p className="text-xs font-medium text-stone-700 mb-1">{r.nombre}</p>
                        <div className="flex flex-wrap gap-2">
                          {r.cambios.map((c, j) => (
                            <span key={j} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-100">
                              {c.campo}: <span className="line-through opacity-60">{c.antes}</span> → <strong>{c.despues}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Sección eliminar */}
            {preview.aEliminar.length > 0 && (
              <div className="border border-red-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleSection('eliminar')}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50 text-left"
                >
                  <span className="text-sm font-medium text-red-800">
                    Desactivar {preview.aEliminar.length} producto{preview.aEliminar.length !== 1 ? 's' : ''} no listado{preview.aEliminar.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-red-600 text-xs">{open.has('eliminar') ? '▲' : '▼'}</span>
                </button>
                {open.has('eliminar') && (
                  <div className="divide-y divide-stone-50 bg-white">
                    {preview.aEliminar.map((r, i) => (
                      <div key={i} className="px-4 py-2 flex items-center justify-between">
                        <span className="text-xs text-stone-700">{r.nombre}</span>
                        <span className="text-xs text-stone-400 font-mono">{r.handle}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!hasChanges && !hasErrors && (
              <p className="text-sm text-stone-400 text-center py-2">Sin cambios — el catálogo ya está sincronizado</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
          <button
            onClick={handleConfirmar}
            disabled={!preview || hasErrors || confirming || !hasChanges}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {confirming && <Spinner className="w-4 h-4 text-cream" />}
            {confirming ? 'Aplicando…' : 'Aplicar cambios'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
