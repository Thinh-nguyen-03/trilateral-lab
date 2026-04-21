import { apiFetch } from './client'

export interface FailureCluster {
  centroid_lat: number
  centroid_lon: number
  count:        number
  hull:         [number, number][]   // closed [lon, lat] ring
}

export interface FailureClusterCell {
  n_failures: number
  clusters:   FailureCluster[]
}

export interface FailureClusterData {
  n_trials_per_config: number
  n_clusters:          number
  strategies:          string[]
  modes:               string[]
  cells:               Record<string, FailureClusterCell>
}

export async function fetchFailureClusters(): Promise<FailureClusterData> {
  return apiFetch<FailureClusterData>('/api/failure-clusters')
}
