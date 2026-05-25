import { api } from './client'
import type { LoginRequest, LoginResponse } from '../types/api'

export const login = (data: LoginRequest) =>
  api.post<LoginResponse>('/api/auth/login', data)
