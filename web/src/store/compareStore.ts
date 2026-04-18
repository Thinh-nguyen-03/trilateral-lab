import { create } from 'zustand'
import type { PointModel, StepResponse } from '../types/api'
import type { DecodedGrid, DecodedParticles } from '../components/map/mapUtils'
import { randomConusPoint } from './simulationStore'

export type CompareStatus = 'idle' | 'running' | 'playing' | 'complete'

export interface CompareSlice {
  sessionId: string | null
  strategy: string
  measurementMode: string
  status: CompareStatus
  history: StepResponse[]
  currentStep: StepResponse | null
  boxLocation: PointModel | null
  decodedGrid: DecodedGrid | null
  decodedParticles: DecodedParticles | null
}

function makeSlice(strategy: string, measurementMode: string): CompareSlice {
  return {
    sessionId: null,
    strategy,
    measurementMode,
    status: 'idle',
    history: [],
    currentStep: null,
    boxLocation: null,
    decodedGrid: null,
    decodedParticles: null,
  }
}

interface CompareState {
  left: CompareSlice
  right: CompareSlice
  sharedBoxLocation: PointModel

  setStrategy: (side: 'left' | 'right', s: string) => void
  setMode: (side: 'left' | 'right', m: string) => void
  setSharedBoxLocation: (loc: PointModel) => void
  setSession: (side: 'left' | 'right', sessionId: string, boxLocation: PointModel) => void
  setStatus: (side: 'left' | 'right', s: CompareStatus) => void
  addStep: (
    side: 'left' | 'right',
    step: StepResponse,
    grid: DecodedGrid | null,
    particles: DecodedParticles | null,
  ) => void
  setComplete: (side: 'left' | 'right', boxLocation: PointModel) => void
  reset: () => void
}

function updateSide(
  state: CompareState,
  side: 'left' | 'right',
  patch: Partial<CompareSlice>,
): Partial<CompareState> {
  return { [side]: { ...state[side], ...patch } }
}

export const useCompareStore = create<CompareState>((set, get) => ({
  left:               makeSlice('info_gain', 'EXACT'),
  right:              makeSlice('random', 'EXACT'),
  sharedBoxLocation:  randomConusPoint(),

  setStrategy: (side, strategy) =>
    set((s) => updateSide(s, side, { strategy })),

  setMode: (side, measurementMode) =>
    set((s) => updateSide(s, side, { measurementMode })),

  setSharedBoxLocation: (sharedBoxLocation) => set({ sharedBoxLocation }),

  setSession: (side, sessionId, boxLocation) =>
    set((s) => updateSide(s, side, {
      sessionId,
      status: 'running',
      history: [],
      currentStep: null,
      boxLocation: null,
      decodedGrid: null,
      decodedParticles: null,
    })),

  setStatus: (side, status) =>
    set((s) => updateSide(s, side, { status })),

  addStep: (side, step, grid, particles) =>
    set((s) => updateSide(s, side, {
      currentStep: step,
      history: [...s[side].history, step],
      decodedGrid: grid,
      decodedParticles: particles,
    })),

  setComplete: (side, boxLocation) =>
    set((s) => updateSide(s, side, { boxLocation, status: 'complete' })),

  reset: () => set({
    left:              makeSlice('info_gain', 'EXACT'),
    right:             makeSlice('random', 'EXACT'),
    sharedBoxLocation: randomConusPoint(),
  }),
}))
