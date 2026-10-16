import type { TipoAjuste, ModoAjuste } from '../types/api'

/**
 * Como se lee cada tipo de movimiento en el historial.
 *
 * Los tipos de produccion existen aparte porque antes se guardaban como MERMA
 * y COMPRA: el consumo de insumos al producir aparecia como desperdicio y el
 * lote producido como compra a proveedor. Con eso no se podia contestar cuanto
 * se echo a perder ni cuanto se le compro a quien.
 */
export const MOVIMIENTOS: Record<string, { etiqueta: string; clase: string }> = {
  COMPRA:             { etiqueta: 'Compra',            clase: 'bg-green-50 text-green-700' },
  VENTA:              { etiqueta: 'Venta',             clase: 'bg-blue-50 text-blue-700' },
  MERMA:              { etiqueta: 'Merma',             clase: 'bg-red-50 text-red-700' },
  AJUSTE:             { etiqueta: 'Ajuste',            clase: 'bg-amber-50 text-amber-700' },
  ANULACION:          { etiqueta: 'Anulación',         clase: 'bg-stone-100 text-stone-600' },
  PRODUCCION_CONSUMO: { etiqueta: 'Producción · usó',  clase: 'bg-indigo-50 text-indigo-700' },
  PRODUCCION_SALIDA:  { etiqueta: 'Producción · hizo', clase: 'bg-teal-50 text-teal-700' },
}

/**
 * Lo que el usuario quiere hacer, en sus palabras.
 *
 * El API pide `tipo` y `modo` por separado, y la combinacion no dice nada por
 * si sola: MERMA, AJUSTE+DELTA y AJUSTE+FIJAR se escriben parecido y hacen
 * cosas muy distintas al stock. Aqui se nombra el efecto y `envio` guarda la
 * traduccion, para que ninguna pantalla la rehaga por su cuenta.
 */
export type Operacion = 'COMPRA' | 'MERMA' | 'SUMAR_RESTAR' | 'FIJAR' | 'PRODUCIR'

interface DefOperacion {
  etiqueta: string
  ayuda: string
  etiquetaCantidad: string
  permiteNegativo: boolean
  /** Compras y produccion exponen costos y recetas: no son del supervisor. */
  soloAdmin: boolean
  /** Produccion solo aplica a ingredientes que tienen sub-receta. */
  requiereSubreceta: boolean
  envio:
    | { via: 'compra' }
    | { via: 'ajuste'; tipo: TipoAjuste; modo: ModoAjuste }
    | { via: 'produccion' }
}

export const OPERACIONES: Record<Operacion, DefOperacion> = {
  COMPRA: {
    etiqueta: 'Compra — llegó del proveedor',
    ayuda: 'Entrada de mercancía que compraste. Suma al stock.',
    etiquetaCantidad: 'Cantidad que llegó',
    permiteNegativo: false, soloAdmin: true, requiereSubreceta: false,
    envio: { via: 'compra' },
  },
  MERMA: {
    etiqueta: 'Merma — se echó a perder',
    ayuda: 'Lo que se tiró, se derramó o caducó. Descuenta del stock y queda registrado como pérdida.',
    etiquetaCantidad: 'Cantidad perdida',
    permiteNegativo: false, soloAdmin: false, requiereSubreceta: false,
    envio: { via: 'ajuste', tipo: 'MERMA', modo: 'DELTA' },
  },
  SUMAR_RESTAR: {
    etiqueta: 'Corregir — sumar o restar',
    ayuda: 'Corrige un error de captura sumando o restando. Usa negativo para restar.',
    etiquetaCantidad: 'Cantidad (+/−)',
    permiteNegativo: true, soloAdmin: false, requiereSubreceta: false,
    envio: { via: 'ajuste', tipo: 'AJUSTE', modo: 'DELTA' },
  },
  FIJAR: {
    etiqueta: 'Corregir — dejar el stock en',
    ayuda: 'Pone el stock en el valor exacto que cuentes en físico. El sistema calcula la diferencia.',
    etiquetaCantidad: 'Stock real contado',
    permiteNegativo: false, soloAdmin: false, requiereSubreceta: false,
    envio: { via: 'ajuste', tipo: 'AJUSTE', modo: 'FIJAR' },
  },
  PRODUCIR: {
    etiqueta: 'Producir — se hizo en cocina',
    ayuda: 'Descuenta los insumos de la sub-receta y suma el lote resultante.',
    etiquetaCantidad: 'Número de lotes',
    permiteNegativo: false, soloAdmin: true, requiereSubreceta: true,
    envio: { via: 'produccion' },
  },
}

/** Las operaciones que este usuario puede hacerle a este ingrediente. */
export function operacionesPara(opts: { isAdmin: boolean; tieneSubreceta: boolean }): Operacion[] {
  return (Object.keys(OPERACIONES) as Operacion[]).filter((clave) => {
    const op = OPERACIONES[clave]
    if (op.soloAdmin && !opts.isAdmin) return false
    if (op.requiereSubreceta && !opts.tieneSubreceta) return false
    return true
  })
}

/**
 * Cuanto se movera el stock, con la misma regla que aplica el backend en
 * InventarioService.deltaDeAjuste. Se repite aqui a proposito: es lo que
 * permite mostrar el resultado antes de guardar, y un ajuste de inventario no
 * se deshace con un boton.
 *
 * PRODUCIR no pasa por aqui — su efecto sale del rendimiento de la sub-receta.
 */
export function deltaPrevisto(operacion: Operacion, cantidad: number, stockActual: number): number {
  switch (operacion) {
    case 'COMPRA':       return Math.abs(cantidad)
    case 'MERMA':        return -Math.abs(cantidad)
    case 'SUMAR_RESTAR': return cantidad
    case 'FIJAR':        return cantidad - stockActual
    case 'PRODUCIR':     return 0
  }
}

/** Quita la cola de decimales que arrastra la suma en punto flotante. */
export const redondear = (v: number) => parseFloat(v.toFixed(3))
