import { create } from 'zustand'
import type { GridMeta, PointModel, StepResponse } from '../types/api'
import type { DecodedGrid, DecodedParticles } from '../components/map/mapUtils'

export type SimStatus = 'idle' | 'running' | 'playing' | 'complete'
export type BoxPlacementMode = 'random' | 'manual'

/** Generate a random point inside the CONUS bounding box. */
export function randomConusPoint(): PointModel {
  return {
    lat: 25.5 + Math.random() * 22.5,  // 25.5 – 48°N
    lon: -124 + Math.random() * 57,     // 124 – 67°W
  }
}

interface SimulationState {
  // Session
  sessionId: string | null
  strategy: string
  measurementMode: string
  gridMeta: GridMeta | null

  // Progression
  status: SimStatus
  history: StepResponse[]
  currentStep: StepResponse | null
  boxLocation: PointModel | null        // confirmed at trial complete
  previewBoxLocation: PointModel        // always set — shown on map before sim starts
  boxPlacementMode: BoxPlacementMode

  // Decoded belief for rendering
  decodedGrid: DecodedGrid | null
  decodedParticles: DecodedParticles | null

  // Actions
  setStrategy: (s: string) => void
  setMeasurementMode: (m: string) => void
  setBoxPlacementMode: (m: BoxPlacementMode) => void
  setPreviewBoxLocation: (loc: PointModel) => void
  setSession: (sessionId: string, gridMeta: GridMeta, boxLocation: PointModel) => void
  setStatus: (s: SimStatus) => void
  addStep: (step: StepResponse, grid: DecodedGrid | null, particles: DecodedParticles | null) => void
  setComplete: (boxLocation: PointModel) => void
  reset: () => void
}

function makeInitial() {
  return {
    sessionId:          null  as string | null,
    status:             'idle' as SimStatus,
    history:            [] as StepResponse[],
    currentStep:        null as StepResponse | null,
    boxLocation:        null as PointModel | null,
    previewBoxLocation: randomConusPoint(),   // always a valid point
    decodedGrid:        null as DecodedGrid | null,
    decodedParticles:   null as DecodedParticles | null,
    gridMeta:           null as GridMeta | null,
  }
}

export const useSimulationStore = create<SimulationState>((set) => ({
  ...makeInitial(),
  strategy:         'max_separation',
  measurementMode:  'ROUND_25_MILES',
  boxPlacementMode: 'random',

  setStrategy:           (strategy)           => set({ strategy }),
  setMeasurementMode:    (measurementMode)     => set({ measurementMode }),
  setBoxPlacementMode:   (boxPlacementMode)    => set({ boxPlacementMode }),
  setPreviewBoxLocation: (previewBoxLocation)  => set({ previewBoxLocation }),

  setSession: (sessionId, gridMeta, boxLocation) =>
    set((state) => ({
      sessionId,
      gridMeta,
      status:             'running',
      history:            [],
      currentStep:        null,
      boxLocation:        null,
      // Fall back to existing preview if backend somehow omits box_location
      previewBoxLocation: boxLocation ?? state.previewBoxLocation,
      decodedGrid:        null,
      decodedParticles:   null,
    })),

  setStatus: (status) => set({ status }),

  addStep: (step, grid, particles) =>
    set((s) => ({
      currentStep:     step,
      history:         [...s.history, step],
      decodedGrid:     grid,
      decodedParticles: particles,
    })),

  setComplete: (boxLocation) => set({ boxLocation, status: 'complete' }),

  // Reset regenerates a fresh random preview location
  reset: () => set({ ...makeInitial() }),
}))
