import { useCallback, useRef } from 'react'
import { startSession, stepSession, deleteSession } from '../api/session'
import { useSimulationStore } from '../store/simulationStore'
import { decodeGridBelief, decodeParticles } from '../components/map/mapUtils'

export function useSimulation() {
  const store = useSimulationStore()
  const steppingRef = useRef(false)
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)

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
    const { strategy, measurementMode } = useSimulationStore.getState()
    const res = await startSession(strategy, measurementMode)
    store.setSession(res.session_id, res.grid_meta)
  }, [store])

  const startAutoPlay = useCallback(() => {
    const { strategy } = useSimulationStore.getState()
    const intervalMs = strategy === 'info_gain' ? 600 : 1200
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
