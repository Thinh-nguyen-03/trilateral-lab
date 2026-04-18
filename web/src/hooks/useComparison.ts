import { useCallback, useRef } from 'react'
import { startSession, stepSession, deleteSession } from '../api/session'
import { useCompareStore } from '../store/compareStore'
import { decodeGridBelief, decodeParticles } from '../components/map/mapUtils'
import type { StepResponse } from '../types/api'

export function useComparison() {
  const store = useCompareStore()
  const autoPlayRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const steppingRef = useRef(false)

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current !== null) {
      clearInterval(autoPlayRef.current)
      autoPlayRef.current = null
    }
    const { left, right } = useCompareStore.getState()
    if (left.status === 'playing')  store.setStatus('left', 'running')
    if (right.status === 'playing') store.setStatus('right', 'running')
  }, [store])

  const stepSide = useCallback(async (side: 'left' | 'right', sessionId: string): Promise<StepResponse | null> => {
    try {
      const res = await stepSession(sessionId)
      const grid      = res.belief.type === 'grid' ? decodeGridBelief(res.belief) : null
      const particles = res.belief.type === 'particles' ? decodeParticles(res.belief) : null
      store.addStep(side, res, grid, particles)
      if (res.trial_complete) store.setComplete(side, res.box_location!)
      return res
    } catch {
      return null
    }
  }, [store])

  const step = useCallback(async () => {
    if (steppingRef.current) return
    steppingRef.current = true
    try {
      const { left, right } = useCompareStore.getState()
      const promises: Promise<StepResponse | null>[] = []
      const active = (s: string) => s === 'running' || s === 'playing'
      if (left.sessionId  && active(left.status))  promises.push(stepSide('left',  left.sessionId))
      if (right.sessionId && active(right.status)) promises.push(stepSide('right', right.sessionId))
      const results = await Promise.all(promises)
      const bothDone = results.every((r) => r?.trial_complete)
      if (bothDone) stopAutoPlay()
    } finally {
      steppingRef.current = false
    }
  }, [stepSide, stopAutoPlay])

  const stepRef = useRef(step)
  stepRef.current = step

  const start = useCallback(async () => {
    const { left, right, sharedBoxLocation } = useCompareStore.getState()
    const [leftRes, rightRes] = await Promise.all([
      startSession(left.strategy, left.measurementMode, sharedBoxLocation),
      startSession(right.strategy, right.measurementMode, sharedBoxLocation),
    ])
    store.setSession('left',  leftRes.session_id, leftRes.box_location)
    store.setSession('right', rightRes.session_id, rightRes.box_location)
  }, [store])

  const startAutoPlay = useCallback(() => {
    store.setStatus('left', 'playing')
    store.setStatus('right', 'playing')
    autoPlayRef.current = setInterval(() => stepRef.current(), 1200)
  }, [store])

  const reset = useCallback(async () => {
    stopAutoPlay()
    const { left, right } = useCompareStore.getState()
    await Promise.all([
      left.sessionId  ? deleteSession(left.sessionId).catch(() => {})  : Promise.resolve(),
      right.sessionId ? deleteSession(right.sessionId).catch(() => {}) : Promise.resolve(),
    ])
    store.reset()
  }, [store, stopAutoPlay])

  return { start, step, startAutoPlay, stopAutoPlay, reset }
}
