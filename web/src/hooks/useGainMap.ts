import { useEffect, useRef } from 'react'
import { useSimulationStore } from '../store/simulationStore'
import { fetchGainMap } from '../api/session'

export function useGainMap() {
  const enabled   = useSimulationStore((s) => s.gainMapEnabled)
  const sessionId = useSimulationStore((s) => s.sessionId)
  const status    = useSimulationStore((s) => s.status)
  const setPoints = useSimulationStore((s) => s.setGainMapPoints)

  const abortRef     = useRef<AbortController | null>(null)
  const prevEnabled  = useRef(false)

  useEffect(() => {
    const justEnabled = enabled && !prevEnabled.current
    prevEnabled.current = enabled

    if (!enabled) { setPoints(null); return }
    if (!justEnabled || !sessionId || status !== 'running') return

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    fetchGainMap(sessionId, ctrl.signal)
      .then((res) => { if (!ctrl.signal.aborted) setPoints(res.points) })
      .catch((err) => { if (err?.name !== 'AbortError') console.error('[gainMap]', err) })

    return () => ctrl.abort()
  }, [enabled, sessionId, status, setPoints])
}
