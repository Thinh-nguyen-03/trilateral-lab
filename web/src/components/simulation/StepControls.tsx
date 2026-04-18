import { useState } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { useSimulation } from '../../hooks/useSimulation'
import styles from './StepControls.module.css'

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8]

export function StepControls() {
  const { status, autoPlaySpeed, setAutoPlaySpeed } = useSimulationStore()
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
      <div className={styles.wrap}>
        <button className={styles.primary} onClick={handleStart} disabled={loading}>
          {loading ? '■ INITIALIZING...' : '▶ LAUNCH TRIAL'}
        </button>
      </div>
    )
  }

  if (status === 'complete') {
    return (
      <div className={styles.wrap}>
        <button className={styles.ghost} onClick={reset}>↺  RESET SYSTEM</button>
      </div>
    )
  }

  return (
    <div className={styles.stack}>
      <div className={styles.wrap}>
        {status === 'playing' ? (
          <>
            <button className={styles.amber} onClick={stopAutoPlay}>⏸  PAUSE</button>
            <button className={`${styles.ghost} ${styles.ghostIcon}`} onClick={reset}>↺</button>
          </>
        ) : (
          <>
            <button className={styles.secondary} onClick={handleStep} disabled={loading}>
              {loading ? '■■■' : '▶  STEP'}
            </button>
            <button className={styles.primary} onClick={startAutoPlay} disabled={loading}>
              ▶▶ AUTO-RUN
            </button>
            <button className={`${styles.ghost} ${styles.ghostIcon}`} onClick={reset}>↺</button>
          </>
        )}
      </div>

      <div className={styles.speedRow}>
        <span className={styles.speedLabel}>SPEED</span>
        {SPEED_OPTIONS.map((s) => (
          <button
            key={s}
            className={`${styles.speedChip} ${autoPlaySpeed === s ? styles.speedChipActive : ''}`}
            onClick={() => setAutoPlaySpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
