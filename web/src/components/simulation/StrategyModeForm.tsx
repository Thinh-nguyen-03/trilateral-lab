import { useCallback } from 'react'
import { useSimulationStore, randomConusPoint } from '../../store/simulationStore'
import styles from './StrategyModeForm.module.css'

const STRATEGIES = [
  { value: 'manual',            label: 'MANUAL  (YOU PICK)' },
  { value: 'fixed',             label: 'FIXED SEQUENCE' },
  { value: 'random',            label: 'RANDOM' },
  { value: 'max_separation',    label: 'MAX-SEPARATION' },
  { value: 'centroid',          label: 'CENTROID' },
  { value: 'adaptive',          label: 'ADAPTIVE  (EXPLORE / EXPLOIT)' },
  { value: 'info_gain',         label: 'INFO-GAIN  [~300ms]' },
  { value: 'entropy_gradient',  label: 'ENTROPY-GRAD  [~300ms]' },
  { value: 'learned',           label: 'LEARNED  (CEM-trained)' },
]

const MODES = [
  { value: 'EXACT',              label: 'EXACT DISTANCE' },
  { value: 'ROUND_10_MILES',     label: 'ROUNDED  ±10 mi' },
  { value: 'ROUND_25_MILES',     label: 'ROUNDED  ±25 mi' },
  { value: 'ROUND_100_MILES',    label: 'ROUNDED ±100 mi' },
  { value: 'NOISY_GAUSSIAN_5',   label: 'GAUSSIAN  σ=5 mi' },
  { value: 'NOISY_GAUSSIAN_25',  label: 'GAUSSIAN σ=25 mi' },
]

export function StrategyModeForm() {
  const {
    strategy, measurementMode, status, setStrategy, setMeasurementMode,
    boxPlacementMode, setBoxPlacementMode,
    previewBoxLocation, setPreviewBoxLocation,
  } = useSimulationStore()
  const locked = status !== 'idle'

  const generateRandom = useCallback(() => {
    setPreviewBoxLocation(randomConusPoint())
  }, [setPreviewBoxLocation])

  const switchToRandom = useCallback(() => {
    setBoxPlacementMode('random')
    generateRandom()
  }, [setBoxPlacementMode, generateRandom])

  const switchToManual = useCallback(() => {
    setBoxPlacementMode('manual')
  }, [setBoxPlacementMode])

  const coordText = previewBoxLocation
    ? `${previewBoxLocation.lat.toFixed(2)}°N  ${Math.abs(previewBoxLocation.lon).toFixed(2)}°W`
    : '—'

  return (
    <div className={styles.form}>
      <Field label="STRATEGY">
        <select
          className={styles.select}
          value={strategy}
          onChange={(e) => setStrategy(e.target.value)}
          disabled={locked}
        >
          {STRATEGIES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </Field>

      <Field label="SENSOR MODE">
        <select
          className={styles.select}
          value={measurementMode}
          onChange={(e) => setMeasurementMode(e.target.value)}
          disabled={locked}
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </Field>

      {/* Target placement */}
      <div className={styles.field}>
        <span className={styles.label}>TARGET PLACEMENT</span>
        <div className={styles.modeToggle}>
          <button
            className={`${styles.modeBtn} ${boxPlacementMode === 'random' ? styles.modeBtnActive : ''}`}
            onClick={switchToRandom}
            disabled={locked}
          >RANDOM</button>
          <button
            className={`${styles.modeBtn} ${boxPlacementMode === 'manual' ? styles.modeBtnActive : ''}`}
            onClick={switchToManual}
            disabled={locked}
          >PICK ON MAP</button>
        </div>

        {/* Coordinates — always shown */}
        <div className={styles.previewRow}>
          <span className={styles.previewCoords}>{coordText}</span>
          {boxPlacementMode === 'random' && (
            <button className={styles.regenBtn} onClick={generateRandom} disabled={locked} title="Regenerate">
              ↻
            </button>
          )}
        </div>

        {boxPlacementMode === 'manual' && !locked && (
          <p className={styles.pickNote}>↓  CLICK MAP TO REPOSITION</p>
        )}
      </div>

      {locked && (
        <p className={styles.lockNote}>CONFIG LOCKED — TRIAL IN PROGRESS</p>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  )
}
