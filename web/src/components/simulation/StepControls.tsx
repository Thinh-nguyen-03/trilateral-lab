import { useState } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { useSimulation } from '../../hooks/useSimulation'
import styles from './StepControls.module.css'

export function StepControls() {
  const { status } = useSimulationStore()
  const { start, step, startAutoPlay, stopAutoPlay, reset } = useSimulation()
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try { await start() } finally { setLoading(false) }
  }

  const handleStep = async () => {
    setLoading(true)
    try { await step() } finally { setLoading(false) }
  }

  if (status === 'idle') {
    return (
      <div className={styles.row}>
        <button className={styles.primary} onClick={handleStart} disabled={loading}>
          {loading ? 'Starting…' : 'Start Trial'}
        </button>
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div className={styles.row}>
        <button className={styles.secondary} onClick={reset}>Reset</button>
      </div>
    )
  }

  return (
    <div className={styles.row}>
      {status === 'playing' ? (
        <button className={styles.secondary} onClick={stopAutoPlay}>Pause</button>
      ) : (
        <>
          <button className={styles.primary} onClick={handleStep} disabled={loading}>
            {loading ? '…' : 'Step'}
          </button>
          <button className={styles.accent} onClick={startAutoPlay} disabled={loading}>
            Auto-play
          </button>
        </>
      )}
      <button className={styles.ghost} onClick={reset}>Reset</button>
    </div>
  )
}
