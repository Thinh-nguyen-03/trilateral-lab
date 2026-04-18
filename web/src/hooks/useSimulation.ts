import { useCallback, useRef } from 'react'
import { startSession, stepSession, deleteSession } from '../api/session'
import { useSimulationStore } from '../store/simulationStore'
import { decodeGridBelief, decodeParticles } from '../components/map/mapUtils'

// Module-level singletons so multiple hook instances (SimulationPage + StepControls)
// share the same timer and guard, preventing double-step and un-clearable intervals.
const _autoPlay = { current: null as ReturnType<typeof setInterval> | null }
const _stepping = { current: false }

export function useSimulation() {
  const store = useSimulationStore()
  const steppingRef = _stepping
  const autoPlayRef = _autoPlay

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current !== null) {
      clearInterval(autoPlayRef.current)
      autoPlayRef.current = null
    }
    // only update status if still playing (not already complete/reset)
    const { status } = useSimulationStore.getState()
    if (status === 'playing') store.setStatus('running')
  }, [store])

  const step = useCallback(async () => {
    const { sessionId } = useSimulationStore.getState()
    if (!sessionId || steppingRef.current) return
    steppingRef.current = true

    try {
      const res = await stepSession(sessionId)

      let grid = null
      let particles = null
      if (res.belief.type === 'grid') {
        grid = decodeGridBelief(res.belief)
      } else {
        particles = decodeParticles(res.belief)
      }

      store.addStep(res, grid, particles)

      if (res.trial_complete) {
        stopAutoPlay()
        store.setComplete(res.box_location!)
      }
    } catch {
      stopAutoPlay()
    } finally {
      steppingRef.current = false
    }
  }, [store, stopAutoPlay])

  // Keep a stable ref to step so the interval always calls the latest version
  const stepRef = useRef(step)
  stepRef.current = step

  const start = useCallback(async () => {
    const { strategy, measurementMode, previewBoxLocation } = useSimulationStore.getState()
    const res = await startSession(strategy, measurementMode, previewBoxLocation)
    store.setSession(res.session_id, res.grid_meta, res.box_location)
  }, [store])

  const startAutoPlay = useCallback(() => {
    const { strategy, autoPlaySpeed } = useSimulationStore.getState()
    const baseMs = strategy === 'info_gain' ? 600 : 1200
    const intervalMs = baseMs / autoPlaySpeed
    store.setStatus('playing')
    autoPlayRef.current = setInterval(() => stepRef.current(), intervalMs)
  }, [store])

  const reset = useCallback(async () => {
    stopAutoPlay()
    const { sessionId } = useSimulationStore.getState()
    if (sessionId) await deleteSession(sessionId).catch(() => {})
    store.reset()
  }, [store, stopAutoPlay])

  return { start, step, startAutoPlay, stopAutoPlay, reset }
}
