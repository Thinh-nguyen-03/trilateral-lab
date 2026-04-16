import { useRef, useEffect } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { weekColor } from '../map/mapUtils'
import styles from './WeekTimeline.module.css'

export function WeekTimeline() {
  const { history } = useSimulationStore()
  const endRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest week
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' })
  }, [history.length])

  if (history.length === 0) {
    return <p className={styles.empty}>Steps will appear here as the trial progresses.</p>
  }

  return (
    <div className={styles.track}>
      {history.map((step, i) => {
        const [r, g, b] = weekColor(i)
        const loc = step.chosen_location
        return (
          <div key={i} className={styles.card}>
            <div className={styles.dot} style={{ background: `rgb(${r},${g},${b})` }} />
            <div className={styles.info}>
              <span className={styles.week}>Wk {step.week}</span>
              <span className={styles.coords}>
                {loc.lat.toFixed(1)}°, {loc.lon.toFixed(1)}°
              </span>
              <span className={styles.dist}>{step.observed_distance.toFixed(0)} mi</span>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
