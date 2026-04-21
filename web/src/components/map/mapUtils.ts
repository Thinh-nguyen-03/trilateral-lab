import pako from 'pako'
import type { GridBeliefModel, ParticleBeliefModel } from '../../types/api'

// Must match src/belief/grid.py exactly
export const GRID = {
  LAT_MIN: 24.5,
  LAT_MAX: 49.5,
  LON_MIN: -124.7,
  LON_MAX: -66.9,
  STEP: 0.1,
  N_LATS: 250,
  N_LONS: 578,
  TOTAL: 250 * 578,
} as const

let _gridPositions: Float32Array | null = null

export function getGridPositions(): Float32Array {
  if (_gridPositions) return _gridPositions
  _gridPositions = new Float32Array(GRID.TOTAL * 2)
  let i = 0
  for (let latIdx = 0; latIdx < GRID.N_LATS; latIdx++) {
    const lat = GRID.LAT_MIN + latIdx * GRID.STEP
    for (let lonIdx = 0; lonIdx < GRID.N_LONS; lonIdx++) {
      const lon = GRID.LON_MIN + lonIdx * GRID.STEP
      _gridPositions[i++] = lon
      _gridPositions[i++] = lat
    }
  }
  return _gridPositions
}

function decodeGzB64(s: string): Float32Array {
  const binary = atob(s)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const inflated = pako.inflate(bytes)
  return new Float32Array(inflated.buffer)
}

export interface GridCell {
  position: [number, number]
  weight: number
}

export interface DecodedGrid {
  cells: GridCell[]
  maxWeight: number
}

export interface DecodedParticles {
  lats: Float32Array
  lons: Float32Array
  weights: Float32Array
}

export function decodeGridBelief(belief: GridBeliefModel): DecodedGrid {
  const weights = decodeGzB64(belief.weights_gz_b64)
  const positions = getGridPositions()
  const cells: GridCell[] = []
  let maxWeight = 0

  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]
    if (w > 0) {
      cells.push({ position: [positions[i * 2], positions[i * 2 + 1]], weight: w })
      if (w > maxWeight) maxWeight = w
    }
  }
  return { cells, maxWeight }
}

export function decodeParticles(belief: ParticleBeliefModel): DecodedParticles {
  return {
    lats: decodeGzB64(belief.lats_gz_b64),
    lons: decodeGzB64(belief.lons_gz_b64),
    weights: decodeGzB64(belief.weights_gz_b64),
  }
}

export const WEEK_PALETTE: [number, number, number][] = [
  [100, 149, 237],
  [255, 165, 0],
  [50, 205, 50],
  [255, 99, 71],
  [138, 43, 226],
  [255, 215, 0],
  [0, 206, 209],
  [255, 20, 147],
  [127, 255, 0],
  [255, 127, 80],
]

export function weekColor(index: number): [number, number, number] {
  return WEEK_PALETTE[index % WEEK_PALETTE.length]
}
