import { api } from './client'
import type { TurnoDTO } from '../types/api'

export const obtenerTurnoActivo = () => api.get<TurnoDTO>('/api/turnos/activo')

export const abrirTurno = (fondoInicial: number) =>
  api.post<TurnoDTO>('/api/turnos/abrir', { fondoInicial })

export const cerrarTurno = (conteoEfectivo: number, notas?: string) =>
  api.post<TurnoDTO>('/api/turnos/cerrar', { conteoEfectivo, notas })

export const registrarMovimiento = (tipo: 'ENTRADA' | 'SALIDA', monto: number, motivo: string) =>
  api.post<TurnoDTO>('/api/turnos/movimiento', { tipo, monto, motivo })

export const listarTurnos = (fecha?: string) =>
  api.get<TurnoDTO[]>(`/api/turnos${fecha ? `?fecha=${fecha}` : ''}`)
