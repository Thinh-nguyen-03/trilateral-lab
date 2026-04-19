import { apiFetch } from './client'

export interface AdversarialCell {
  mean_weeks:   (number | null)[][]
  failure_rate: (number | null)[][]
  worst_box:    { lat: number; lon: number; mean_weeks: number } | null
}

export interface AdversarialData {
  lat_grid:          number[]
  lon_grid:          number[]
  strategies:        string[]
  modes:             string[]
  k_trials_per_cell: number
  cells:             Record<string, AdversarialCell>
}

export async function fetchAdversarial(): Promise<AdversarialData> {
  return apiFetch<AdversarialData>('/api/adversarial')
}
