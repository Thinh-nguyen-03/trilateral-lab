import { useState, useCallback, useRef } from 'react'
import { startSession, stepSession } from '../api/session'
import { randomConusPoint } from '../store/simulationStore'

export type RaceResult = { winner: 'A' | 'B' | 'tied'; aWeeks: number; bWeeks: number }

export function useRaces() {
  const [results, setResults]   = useState<RaceResult[]>([])
  const [running, setRunning]   = useState(false)
  const [done, setDone]         = useState(0)
  const [total, setTotal]       = useState(0)
  const abortRef                = useRef(false)

  const run = useCallback(async (
    stratA: string, modeA: string,
    stratB: string, modeB: string,
    n = 5,
  ) => {
    abortRef.current = false
    setRunning(true)
    setResults([])
    setDone(0)
    setTotal(n)

    for (let i = 0; i < n; i++) {
      if (abortRef.current) break
      const box = randomConusPoint()

      const [sessA, sessB] = await Promise.all([
        startSession(stratA, modeA, box),
        startSession(stratB, modeB, box),
      ])

      let aDone = false, bDone = false
      let aWeeks = 52, bWeeks = 52
      let aLoc = false, bLoc = false

      while (!aDone || !bDone) {
        if (abortRef.current) break
        const [rA, rB] = await Promise.all([
          aDone ? null : stepSession(sessA.session_id),
          bDone ? null : stepSession(sessB.session_id),
        ])
        if (rA?.trial_complete) { aDone = true; aWeeks = rA.week; aLoc = rA.localized }
        if (rB?.trial_complete) { bDone = true; bWeeks = rB.week; bLoc = rB.localized }
      }

      const winner: RaceResult['winner'] =
        !aLoc && !bLoc ? 'tied'
        : !aLoc        ? 'B'
        : !bLoc        ? 'A'
        : aWeeks < bWeeks ? 'A'
        : bWeeks < aWeeks ? 'B'
        : 'tied'

      setResults(prev => [...prev, { winner, aWeeks, bWeeks }])
      setDone(i + 1)
    }

    setRunning(false)
  }, [])

  const abort = useCallback(() => { abortRef.current = true }, [])
  const reset = useCallback(() => { setResults([]); setDone(0); setTotal(0) }, [])

  return { results, running, done, total, run, abort, reset }
}
