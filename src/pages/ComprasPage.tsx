import { useEffect, useMemo, useRef, useState } from 'react'
import {
  listarCompras, resumenCompras, crearCompra, eliminarCompra,
  extraccionDisponible, extraerTicket,
} from '../api/compras'
import { esErrorDeRed } from '../api/errores'
import { comprimirImagen } from '../utils/imagen'
import { CATEGORIAS_COMPRA } from '../types/api'
import type {
  CompraDTO, CompraLineaRequest, CategoriaCompra, ResumenCompras,
} from '../types/api'
import Modal from '../components/Modal'
import Spinner from '../components/Spinner'

/**
 * Compras a proveedores y tiendas: control de gasto.
 *
 * El flujo es foto → propuesta → revisión → guardar. El paso de revisión no es
 * opcional: un ticket térmico arrugado se lee mal a veces, y un total
 * equivocado que entrara solo contaminaría las cifras sin que nadie lo notara.
 */

const fmt = (n: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)

const hoyISO = () => new Date().toISOString().slice(0, 10)
const primerDiaDelMes = () => hoyISO().slice(0, 8) + '01'

/** Borrador editable de la pantalla de revisión. */
interface Borrador {
  proveedor: string
  fecha: string
  total: string
  categoria: CategoriaCompra
  notas: string
  lineas: { descripcion: string; cantidad: string; precioUnitario: string; importe: string }[]
  /** Miniatura para no perder de vista el ticket mientras se corrige. */
  vistaPrevia: string | null
}

const borradorVacio = (): Borrador => ({
  proveedor: '', fecha: hoyISO(), total: '', categoria: 'INSUMOS',
  notas: '', lineas: [], vistaPrevia: null,
})

export default function ComprasPage() {
  const [compras, setCompras] = useState<CompraDTO[]>([])
  const [resumen, setResumen] = useState<ResumenCompras | null>(null)
  const [desde, setDesde] = useState(primerDiaDelMes())
  const [hasta, setHasta] = useState(hoyISO())
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const [conCamara, setConCamara] = useState(false)
  const [leyendo, setLeyendo] = useState(false)
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)

  const inputFoto = useRef<HTMLInputElement>(null)

  const refrescar = async () => {
    try {
      const [lista, res] = await Promise.all([
        listarCompras(desde, hasta),
        resumenCompras(desde, hasta),
      ])
      setCompras(lista)
      setResumen(res)
      setError('')
    } catch (e) {
      setError(esErrorDeRed(e) ? 'Sin conexión' : 'No se pudieron cargar las compras')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => { refrescar() }, [desde, hasta])

  // Si no hay llave configurada en el servidor, no se ofrece la cámara: el
  // botón existiría solo para fallar.
  useEffect(() => {
    extraccionDisponible()
      .then(r => setConCamara(r.disponible))
      .catch(() => setConCamara(false))
  }, [])

  const totalPeriodo = resumen?.total ?? 0
  const categoriasOrdenadas = useMemo(() => {
    if (!resumen) return []
    return Object.entries(resumen.porCategoria).sort((a, b) => b[1] - a[1])
  }, [resumen])

  const alElegirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''   // permite volver a elegir la misma foto
    if (file) procesarArchivo(file)
  }

  const alSoltar = (e: React.DragEvent) => {
    e.preventDefault()
    setArrastrando(false)
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (!file) {
      setError('Eso no es una imagen. Arrastra la foto del ticket.')
      return
    }
    procesarArchivo(file)
  }

  /**
   * Pegar la imagen con Ctrl+V. En una computadora es lo más rápido: recortas
   * el ticket, copias, pegas — sin pasar por el disco.
   *
   * Se ignora en dos casos, y los dos importan: cuando el foco está en un campo
   * de texto (pegar ahí es pegar texto, no adjuntar una foto) y cuando hay un
   * borrador abierto (pegar lo reemplazaría y se perdería lo ya corregido).
   */
  const borradorRef = useRef(borrador)
  borradorRef.current = borrador

  useEffect(() => {
    if (!conCamara) return

    const alPegar = (e: ClipboardEvent) => {
      const destino = e.target as HTMLElement | null
      if (destino && (destino.tagName === 'INPUT' || destino.tagName === 'TEXTAREA'
              || destino.isContentEditable)) return
      if (borradorRef.current) return

      const item = Array.from(e.clipboardData?.items ?? [])
              .find(i => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (!file) return

      e.preventDefault()
      procesarArchivo(file)
    }

    document.addEventListener('paste', alPegar)
    return () => document.removeEventListener('paste', alPegar)
    // procesarArchivo se recrea en cada render pero solo lee estado por setters,
    // asi que registrar una vez por disponibilidad de camara es suficiente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conCamara])

  /** Foto → propuesta. Si la lectura falla, se abre el borrador vacío para capturar a mano. */
  const procesarArchivo = async (file: File) => {
    setLeyendo(true)
    setError('')
    try {
      const foto = await comprimirImagen(file)
      const propuesta = await extraerTicket(foto.base64, foto.tipoMime)

      setBorrador({
        proveedor: propuesta.proveedor ?? '',
        fecha: propuesta.fecha ?? hoyISO(),
        total: propuesta.total != null ? String(propuesta.total) : '',
        categoria: propuesta.categoria ?? 'INSUMOS',
        notas: '',
        lineas: (propuesta.lineas ?? []).map(l => ({
          descripcion: l.descripcion ?? '',
          cantidad: l.cantidad != null ? String(l.cantidad) : '',
          precioUnitario: l.precioUnitario != null ? String(l.precioUnitario) : '',
          importe: l.importe != null ? String(l.importe) : '',
        })),
        vistaPrevia: foto.dataUrl,
      })
    } catch (err) {
      // No se pierde la captura por un fallo de lectura: se abre en blanco.
      setError(err instanceof Error ? err.message : 'No se pudo leer el ticket')
      setBorrador(borradorVacio())
    } finally {
      setLeyendo(false)
    }
  }

  const guardar = async () => {
    if (!borrador) return
    const total = parseFloat(borrador.total)
    if (isNaN(total) || total <= 0) { setError('El total tiene que ser un número mayor que cero'); return }

    setGuardando(true)
    setError('')
    try {
      const lineas: CompraLineaRequest[] = borrador.lineas
        .filter(l => l.descripcion.trim())
        .map(l => ({
          descripcion: l.descripcion.trim(),
          cantidad: l.cantidad ? parseFloat(l.cantidad) : null,
          precioUnitario: l.precioUnitario ? parseFloat(l.precioUnitario) : null,
          importe: parseFloat(l.importe) || 0,
        }))

      await crearCompra({
        proveedor: borrador.proveedor.trim() || null,
        fecha: borrador.fecha,
        total,
        categoria: borrador.categoria,
        notas: borrador.notas.trim() || null,
        clientId: crypto.randomUUID(),
        lineas,
      })
      setBorrador(null)
      await refrescar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la compra')
    } finally {
      setGuardando(false)
    }
  }

  const borrar = async (c: CompraDTO) => {
    try {
      await eliminarCompra(c.id)
      await refrescar()
    } catch {
      setError('No se pudo eliminar la compra')
    }
  }

  if (cargando) return (
    <div className="flex-1 flex items-center justify-center">
      <Spinner className="w-8 h-8 text-forest" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-stone-800">Compras</h1>
          <p className="text-sm text-stone-500">Lo que sale del negocio en insumos y suministros</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" className="input w-auto" value={desde} onChange={e => setDesde(e.target.value)} />
          <span className="text-stone-400">a</span>
          <input type="date" className="input w-auto" value={hasta} onChange={e => setHasta(e.target.value)} />
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="card p-4">
          <p className="text-xs uppercase tracking-wide text-stone-400">Gasto del periodo</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">{fmt(totalPeriodo)}</p>
          <p className="text-xs text-stone-400 mt-1">{resumen?.compras ?? 0} compras</p>
        </div>
        <div className="card p-4 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-stone-400 mb-2">Por categoría</p>
          {categoriasOrdenadas.length === 0 ? (
            <p className="text-sm text-stone-400">Sin compras en este rango</p>
          ) : (
            <div className="space-y-1.5">
              {categoriasOrdenadas.map(([cat, monto]) => (
                <div key={cat} className="flex items-center gap-3 text-sm">
                  <span className="text-stone-600 w-32">{cat}</span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full bg-forest rounded-full"
                         style={{ width: `${totalPeriodo > 0 ? (monto / totalPeriodo) * 100 : 0}%` }} />
                  </div>
                  <span className="text-stone-700 font-medium w-24 text-right">{fmt(monto)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toda la zona de botones acepta que le suelten la foto encima. En una
          computadora arrastrar es mas directo que abrir el selector; en un
          telefono estos eventos no se disparan nunca, asi que no estorba. */}
      <div
        onDragOver={(e) => { if (conCamara) { e.preventDefault(); setArrastrando(true) } }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { if (conCamara) alSoltar(e) }}
        className={`flex flex-wrap items-center gap-2 mb-5 rounded-xl transition-colors ${
          arrastrando ? 'ring-2 ring-forest bg-forest/5 p-3 -m-1' : ''
        }`}
      >
        {conCamara && (
          <>
            {/* Sin `capture`: así el selector ofrece cámara Y galería. Es
                deliberado — el modo documento del propio teléfono recorta el
                ticket y corrige la perspectiva, y un ticket recortado aprovecha
                toda la resolución en la letra en vez de gastarla en la mesa.
                Forzar la cámara directa impediría usar esa foto ya escaneada. */}
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={alElegirFoto}
            />
            <button
              onClick={() => inputFoto.current?.click()}
              disabled={leyendo}
              className="btn-primary flex items-center gap-2"
            >
              {leyendo && <Spinner className="w-4 h-4 text-cream" />}
              {leyendo ? 'Leyendo el ticket…' : 'Capturar ticket'}
            </button>
          </>
        )}
        <button onClick={() => setBorrador(borradorVacio())} className="btn-secondary">
          Capturar a mano
        </button>
        {conCamara && (
          <span className={`text-xs ${arrastrando ? 'text-forest font-medium' : 'text-stone-400'}`}>
            {arrastrando ? 'Suelta la foto aquí' : 'o arrástrala aquí, o pégala con Ctrl+V'}
          </span>
        )}
      </div>

      {conCamara && (
        // Es el consejo que más cambia la precisión, y no cuesta nada: el
        // recorte concentra toda la resolución en la letra del ticket en vez
        // de gastarla en la mesa de alrededor.
        <p className="text-xs text-stone-400 mb-5 -mt-2">
          Se lee mejor si escaneas el ticket con el modo documento del teléfono y eliges esa foto:
          recortado, la letra chica se aprovecha entera. Evita el blanco y negro puro — borra la tinta despintada.
        </p>
      )}

      <div className="card divide-y divide-stone-100">
        {compras.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-400">Sin compras registradas en este rango</p>
        ) : compras.map(c => (
          <div key={c.id} className="p-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-stone-800">{c.proveedor || 'Sin proveedor'}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-muted text-forest">{c.categoria}</span>
                {!c.cuadra && (
                  // La suma de las líneas no da el total: algo se leyó mal.
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"
                        title="Las líneas no suman el total">
                    Revisar
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {c.fecha}{c.lineas.length > 0 && ` · ${c.lineas.length} productos`}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-semibold text-stone-800">{fmt(c.total)}</span>
              <button onClick={() => borrar(c)} className="text-stone-300 hover:text-red-600 text-sm">
                Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {borrador && (
        <ModalRevision
          borrador={borrador}
          setBorrador={setBorrador}
          onGuardar={guardar}
          guardando={guardando}
          onCerrar={() => setBorrador(null)}
        />
      )}
    </div>
  )
}

interface RevisionProps {
  borrador: Borrador
  setBorrador: (b: Borrador) => void
  onGuardar: () => void
  guardando: boolean
  onCerrar: () => void
}

function ModalRevision({ borrador, setBorrador, onGuardar, guardando, onCerrar }: RevisionProps) {
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setBorrador({ ...borrador, [k]: v })

  const sumaLineas = borrador.lineas.reduce((s, l) => s + (parseFloat(l.importe) || 0), 0)
  const total = parseFloat(borrador.total) || 0
  // El mismo chequeo que hace el servidor, aquí en vivo: si no cuadra, quien
  // captura lo ve antes de guardar en vez de enterarse después.
  const descuadre = borrador.lineas.length > 0 && Math.abs(sumaLineas - total) > 1

  const setLinea = (i: number, campo: keyof Borrador['lineas'][number], v: string) => {
    const lineas = borrador.lineas.map((l, j) => j === i ? { ...l, [campo]: v } : l)
    setBorrador({ ...borrador, lineas })
  }

  return (
    <Modal title="Revisar la compra" onClose={onCerrar} size="lg">
      <div className="space-y-5">
        <p className="text-xs text-stone-400 -mt-2">
          Corrige lo que haga falta antes de guardar. Nada se registra hasta que confirmes.
        </p>

        {borrador.vistaPrevia && (
          <img src={borrador.vistaPrevia} alt="Ticket"
               className="max-h-48 rounded-lg border border-stone-200 mx-auto" />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Proveedor</label>
            <input className="input" value={borrador.proveedor}
                   onChange={e => set('proveedor', e.target.value)} placeholder="Chedraui, mercado…" />
          </div>
          <div>
            <label className="label">Fecha</label>
            <input type="date" className="input" value={borrador.fecha}
                   onChange={e => set('fecha', e.target.value)} />
          </div>
          <div>
            <label className="label">Total</label>
            <input type="number" step="0.01" className="input" value={borrador.total}
                   onChange={e => set('total', e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={borrador.categoria}
                    onChange={e => set('categoria', e.target.value as CategoriaCompra)}>
              {CATEGORIAS_COMPRA.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {borrador.lineas.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm font-medium text-stone-700">Productos</p>
              <p className={`text-xs ${descuadre ? 'text-amber-700' : 'text-stone-400'}`}>
                Suman {fmt(sumaLineas)}{descuadre && ' — no cuadra con el total'}
              </p>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {borrador.lineas.map((l, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <input className="input col-span-6 text-sm" value={l.descripcion}
                         onChange={e => setLinea(i, 'descripcion', e.target.value)} />
                  <input className="input col-span-2 text-sm" value={l.cantidad} placeholder="cant."
                         onChange={e => setLinea(i, 'cantidad', e.target.value)} />
                  <input className="input col-span-4 text-sm" value={l.importe} placeholder="importe"
                         onChange={e => setLinea(i, 'importe', e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label">Notas</label>
          <input className="input" value={borrador.notas}
                 onChange={e => set('notas', e.target.value)} placeholder="Opcional" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCerrar} className="btn-secondary">Cancelar</button>
          <button onClick={onGuardar} disabled={guardando}
                  className="btn-primary flex items-center gap-2">
            {guardando && <Spinner className="w-4 h-4 text-cream" />}
            Guardar compra
          </button>
        </div>
      </div>
    </Modal>
  )
}
