export interface PointModel {
  lat: number
  lon: number
}

export interface MeasurementModel {
  location: PointModel
  distance: number
}

export interface GridBeliefModel {
  type: 'grid'
  weights_gz_b64: string
  shape: [number, number]
  nonzero_count: number
}

export interface ParticleBeliefModel {
  type: 'particles'
  lats_gz_b64: string
  lons_gz_b64: string
  weights_gz_b64: string
  n_particles: number
}

export type BeliefModel = GridBeliefModel | ParticleBeliefModel

export interface GridMeta {
  lat_min: number
  lat_max: number
  lon_min: number
  lon_max: number
  step: number
  n_lats: number
  n_lons: number
}

export interface StartSessionResponse {
  session_id: string
  strategy: string
  measurement_mode: string
  grid_meta: GridMeta
  box_location: PointModel
}

export interface EllipseModel {
  center_lat: number
  center_lon: number
  semi_major_mi: number
  semi_minor_mi: number
  angle_deg: number
}

export interface StepResponse {
  week: number
  localized: boolean
  trial_complete: boolean
  chosen_location: PointModel
  observed_distance: number
  best_estimate: PointModel | null
  uncertainty_radius: number
  measurements: MeasurementModel[]
  belief: BeliefModel
  box_location: PointModel | null
  gain_map_points?: { lat: number; lon: number; gain: number }[] | null
  ellipse?: EllipseModel | null
}

export interface RegionStats {
  n_trials: number
  failure_rate: number
  mean: number
  median: number
}

export interface ThresholdStats {
  failure_rate: number
  mean: number
  median: number
  p90: number
}

export interface ResultStats {
  n_trials: number
  mean: number
  median: number
  p90: number
  p95: number
  p99: number
  max: number
  failure_rate: number
  median_radius_curve?: number[]
  regional_stats?: Record<string, RegionStats | null>
  threshold_stats?: Record<string, ThresholdStats>
  mean_ci?: [number, number]
  failure_rate_ci?: [number, number]
  cdf_curve?: number[]
}

export type RawResults = Record<string, ResultStats>

export interface ResultRow extends ResultStats {
  strategy: string
  mode: string
  strategy_label: string
  mode_label: string
}
