import { apiFetch } from './client'

export interface CrlbData {
  weeks:  number[]
  curves: Record<string, number[]>  // mode -> radius per week (miles)
  n_boxes_per_mode: number
}

export async function fetchCrlb(): Promise<CrlbData> {
  return apiFetch<CrlbData>('/api/crlb')
}
