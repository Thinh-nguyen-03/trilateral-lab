import { useSimulationStore } from '../../store/simulationStore'
import styles from './StrategyModeForm.module.css'

const STRATEGIES = [
  { value: 'fixed', label: 'Fixed Sequence' },
  { value: 'random', label: 'Random' },
  { value: 'max_separation', label: 'Max-Separation' },
  { value: 'centroid', label: 'Centroid' },
  { value: 'info_gain', label: 'Info-Gain (~300ms/step)' },
]

const MODES = [
  { value: 'EXACT', label: 'Exact distance' },
  { value: 'ROUND_10_MILES', label: 'Rounded to 10 mi' },
  { value: 'ROUND_25_MILES', label: 'Rounded to 25 mi' },
  { value: 'ROUND_100_MILES', label: 'Rounded to 100 mi' },
  { value: 'NOISY_GAUSSIAN_5', label: 'Gaussian noise σ=5 mi' },
  { value: 'NOISY_GAUSSIAN_25', label: 'Gaussian noise σ=25 mi' },
]

export function StrategyModeForm() {
  const { strategy, measurementMode, status, setStrategy, setMeasurementMode } =
    useSimulationStore()
  const disabled = status !== 'idle'

  return (
    <div className={styles.form}>
      <label className={styles.label}>
        Strategy
        <select
          className={styles.select}
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          disabled={disabled}
        >
          {STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.label}>
        Measurement mode
        <select
          className={styles.select}
          value={measurementMode}
          onChange={(e) => setMeasurementMode(e.target.value)}
          disabled={disabled}
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
