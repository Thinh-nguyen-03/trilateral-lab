import { useRef, useEffect } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { weekColor } from '../map/mapUtils'
import styles from './WeekTimeline.module.css'

export function WeekTimeline() {
  const { history } = useSimulationStore()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [history.length])

  if (history.length === 0) {
    return <p className={styles.empty}>— NO DATA —</p>
  }

  return (
    <div className={styles.track}>
      {history.map((step, i) => {
        const [r, g, b] = weekColor(i)
        const loc = step.chosen_location
        return (
          <div key={i} className={styles.row}>
            <span className={styles.week}>W{String(step.week).padStart(2, '0')}</span>
            <div
              className={styles.bar}
              style={{ borderLeftColor: `rgb(${r},${g},${b})` }}
            >
              <span className={styles.coords}>
                {loc.lat.toFixed(2)}°N  {Math.abs(loc.lon).toFixed(2)}°W
              </span>
              <div className={styles.stats}>
                <span className={styles.dist}>{step.observed_distance.toFixed(0)} mi</span>
                {step.uncertainty_radius < Infinity && (
                  <span className={styles.unc}>±{step.uncertainty_radius.toFixed(0)}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
