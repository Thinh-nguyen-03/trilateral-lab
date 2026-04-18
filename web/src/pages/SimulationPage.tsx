import { useState } from 'react'
import { SimulationMap } from '../components/map/SimulationMap'
import { SidePanel } from '../components/simulation/SidePanel'
import { useSimulationStore } from '../store/simulationStore'
import { useSimulation } from '../hooks/useSimulation'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import styles from './SimulationPage.module.css'

const STATUS_META: Record<string, { label: string; cls: string }> = {
  idle:     { label: 'STANDBY',      cls: 'idle' },
  running:  { label: 'MISSION ACTIVE', cls: 'running' },
  playing:  { label: 'AUTO-RUNNING', cls: 'playing' },
  complete: { label: 'COMPLETE',     cls: 'complete' },
}

export function SimulationPage() {
  const [panelOpen, setPanelOpen] = useState(true)
  const { status, strategy, currentStep } = useSimulationStore()
  const meta = STATUS_META[status] ?? STATUS_META.idle
  const { start, step, startAutoPlay, stopAutoPlay, reset } = useSimulation()

  useKeyboardShortcuts({ start, step, startAutoPlay, stopAutoPlay, reset, status, strategy })

  const completeColor =
    status === 'complete'
      ? currentStep?.localized
        ? styles.localized
        : styles.timeout
      : ''

  return (
    <div className={styles.page}>
      {/* ── Top status bar ─────────────────────────────── */}
      <header className={styles.bar}>
        <div className={styles.barLeft}>
          <button
            className={styles.toggle}
            onClick={() => setPanelOpen((p) => !p)}
            title={panelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            {panelOpen ? '◀' : '▶'}
          </button>
          <span className={styles.sysId}>TRI-LAT-SIM // v1.0</span>
          <span className={styles.sep}>│</span>
          <span className={`${styles.badge} ${styles[`badge_${meta.cls}`]} ${completeColor}`}>
            <span className={styles.pulse} />
            {meta.label}
          </span>
          {(status === 'running' || status === 'playing') && currentStep && (
            <span className={styles.weekCounter}>
              W{String(currentStep.week).padStart(2, '0')} / 52
            </span>
          )}
          {status === 'complete' && currentStep && (
            <span className={styles.resultNote}>
              {currentStep.localized
                ? `LOCALIZED  W${currentStep.week}`
                : 'TIMEOUT  W52'}
            </span>
          )}
        </div>
        <div className={styles.barRight}>
          <span className={styles.specTag}>CONUS</span>
          <span className={styles.specTag}>GRID 144K</span>
          <span className={styles.specTag}>PARTICLE 10K</span>
        </div>
      </header>

      {/* ── Main layout ────────────────────────────────── */}
      <div className={styles.layout}>
        <SidePanel open={panelOpen} />
        <div className={styles.mapWrap}>
          <SimulationMap />
        </div>
      </div>
    </div>
  )
}
