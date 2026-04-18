import { useState } from 'react'
import { useCompareStore } from '../store/compareStore'
import { useComparison } from '../hooks/useComparison'
import { CompareMapPanel } from '../components/compare/CompareMapPanel'
import { randomConusPoint } from '../store/simulationStore'
import styles from './ComparePage.module.css'

const STRATEGIES = [
  { value: 'fixed',             label: 'FIXED' },
  { value: 'random',            label: 'RANDOM' },
  { value: 'max_separation',    label: 'MAX-SEP' },
  { value: 'centroid',          label: 'CENTROID' },
  { value: 'info_gain',         label: 'INFO-GAIN' },
  { value: 'entropy_gradient',  label: 'ENTROPY-GRAD' },
]

const MODES = [
  { value: 'EXACT',              label: 'EXACT' },
  { value: 'ROUND_10_MILES',     label: 'RND ±10mi' },
  { value: 'ROUND_25_MILES',     label: 'RND ±25mi' },
  { value: 'ROUND_100_MILES',    label: 'RND ±100mi' },
  { value: 'NOISY_GAUSSIAN_5',   label: 'GAUSS σ5' },
  { value: 'NOISY_GAUSSIAN_25',  label: 'GAUSS σ25' },
]

export function ComparePage() {
  const { left, right, sharedBoxLocation, setStrategy, setMode, setSharedBoxLocation } =
    useCompareStore()
  const { start, step, startAutoPlay, stopAutoPlay, reset } = useComparison()
  const [loading, setLoading] = useState(false)

  const locked = left.status !== 'idle' || right.status !== 'idle'
  const bothPlaying  = left.status === 'playing' && right.status === 'playing'
  const bothComplete = left.status === 'complete' && right.status === 'complete'
  const anyRunning   = (left.status === 'running' || right.status === 'running') && !bothComplete

  const handleStart = async () => {
    setLoading(true)
    try { await start() } finally { setLoading(false) }
  }

  const handleStep = async () => {
    setLoading(true)
    try { await step() } finally { setLoading(false) }
  }

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <div className={styles.barLeft}>
          <span className={styles.title}>COMPARISON MODE</span>
          <span className={styles.sep}>│</span>
          <span className={styles.coord}>
            TARGET {sharedBoxLocation.lat.toFixed(2)}°N {Math.abs(sharedBoxLocation.lon).toFixed(2)}°W
          </span>
          {!locked && (
            <button
              className={styles.regenBtn}
              onClick={() => setSharedBoxLocation(randomConusPoint())}
              title="Randomize target"
            >
              ↻
            </button>
          )}
        </div>

        <div className={styles.controls}>
          {!locked && (
            <button
              className={styles.btnPrimary}
              onClick={handleStart}
              disabled={loading}
            >
              {loading ? '■ INIT...' : '▶ LAUNCH BOTH'}
            </button>
          )}
          {bothComplete && (
            <button className={styles.btnGhost} onClick={reset}>↺ RESET</button>
          )}
          {anyRunning && !bothPlaying && (
            <>
              <button className={styles.btnSecondary} onClick={handleStep} disabled={loading}>
                ▶ STEP
              </button>
              <button className={styles.btnPrimary} onClick={startAutoPlay} disabled={loading}>
                ▶▶ AUTO-RUN
              </button>
              <button className={styles.btnGhost} onClick={reset}>↺</button>
            </>
          )}
          {bothPlaying && (
            <>
              <button className={styles.btnAmber} onClick={stopAutoPlay}>⏸ PAUSE</button>
              <button className={styles.btnGhost} onClick={reset}>↺</button>
            </>
          )}
        </div>
      </header>

      {locked && (
        <div className={styles.configBar}>
          <ConfigSelects
            side="left"
            slice={left}
            locked={locked}
            onStrategy={(v) => setStrategy('left', v)}
            onMode={(v) => setMode('left', v)}
          />
          <div className={styles.configDivider} />
          <ConfigSelects
            side="right"
            slice={right}
            locked={locked}
            onStrategy={(v) => setStrategy('right', v)}
            onMode={(v) => setMode('right', v)}
          />
        </div>
      )}

      {!locked && (
        <div className={styles.configBar}>
          <ConfigSelects
            side="left"
            slice={left}
            locked={false}
            onStrategy={(v) => setStrategy('left', v)}
            onMode={(v) => setMode('left', v)}
          />
          <div className={styles.configDivider} />
          <ConfigSelects
            side="right"
            slice={right}
            locked={false}
            onStrategy={(v) => setStrategy('right', v)}
            onMode={(v) => setMode('right', v)}
          />
        </div>
      )}

      <div className={styles.maps}>
        <CompareMapPanel slice={left}  label="CONFIG A" accentColor="#00bcd4" />
        <div className={styles.mapDivider} />
        <CompareMapPanel slice={right} label="CONFIG B" accentColor="#ffab00" />
      </div>
    </div>
  )
}

interface ConfigSelectsProps {
  side: 'left' | 'right'
  slice: { strategy: string; measurementMode: string }
  locked: boolean
  onStrategy: (v: string) => void
  onMode: (v: string) => void
}

function ConfigSelects({ side, slice, locked, onStrategy, onMode }: ConfigSelectsProps) {
  const color = side === 'left' ? '#00bcd4' : '#ffab00'
  return (
    <div className={styles.configGroup}>
      <span className={styles.configLabel} style={{ color }}>{side === 'left' ? 'CONFIG A' : 'CONFIG B'}</span>
      <select
        className={styles.select}
        value={slice.strategy}
        onChange={(e) => onStrategy(e.target.value)}
        disabled={locked}
      >
        {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
      <select
        className={styles.select}
        value={slice.measurementMode}
        onChange={(e) => onMode(e.target.value)}
        disabled={locked}
      >
        {MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
    </div>
  )
}
