import { create } from 'zustand'
import type { GridMeta, PointModel, StepResponse } from '../types/api'
import type { DecodedGrid, DecodedParticles } from '../components/map/mapUtils'

export type SimStatus = 'idle' | 'running' | 'playing' | 'complete'

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
  boxLocation: PointModel | null

  // Decoded belief for rendering
  decodedGrid: DecodedGrid | null
  decodedParticles: DecodedParticles | null

  // Actions
  setStrategy: (s: string) => void
  setMeasurementMode: (m: string) => void
  setSession: (sessionId: string, gridMeta: GridMeta) => void
  setStatus: (s: SimStatus) => void
  addStep: (step: StepResponse, grid: DecodedGrid | null, particles: DecodedParticles | null) => void
  setComplete: (boxLocation: PointModel) => void
  reset: () => void
}

const INITIAL: Pick<SimulationState,
  'sessionId' | 'status' | 'history' | 'currentStep' | 'boxLocation' |
  'decodedGrid' | 'decodedParticles' | 'gridMeta'
> = {
  sessionId: null,
  status: 'idle',
  history: [],
  currentStep: null,
  boxLocation: null,
  decodedGrid: null,
  decodedParticles: null,
  gridMeta: null,
}

export const useSimulationStore = create<SimulationState>((set) => ({
  ...INITIAL,
  strategy: 'max_separation',
  measurementMode: 'ROUND_25_MILES',

  setStrategy: (strategy) => set({ strategy }),
  setMeasurementMode: (measurementMode) => set({ measurementMode }),

  setSession: (sessionId, gridMeta) =>
    set({ sessionId, gridMeta, status: 'running', history: [], currentStep: null,
          boxLocation: null, decodedGrid: null, decodedParticles: null }),

  setStatus: (status) => set({ status }),

  addStep: (step, grid, particles) =>
    set((s) => ({
      currentStep: step,
      history: [...s.history, step],
      decodedGrid: grid,
      decodedParticles: particles,
    })),

  setComplete: (boxLocation) => set({ boxLocation, status: 'complete' }),

  reset: () => set({ ...INITIAL }),
}))
