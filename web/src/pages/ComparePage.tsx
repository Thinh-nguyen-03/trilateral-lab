import { useState, useCallback } from 'react'
import type { CompareSlice } from '../store/compareStore'
import { useCompareStore } from '../store/compareStore'
import { useComparison } from '../hooks/useComparison'
import { CompareMapPanel } from '../components/compare/CompareMapPanel'
import { randomConusPoint } from '../store/simulationStore'
import { fetchAdversarial } from '../api/adversarial'
import { useRaces } from '../hooks/useRaces'
import type { RaceResult } from '../hooks/useRaces'
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
  const [scrubStep, setScrubStep] = useState<number | undefined>(undefined)
  const maxHistory = Math.max(left.history.length, right.history.length)

  const seedAdversarial = useCallback(async () => {
    try {
      const data = await fetchAdversarial()
      const fallbacks = ['max_separation', 'centroid', 'random', 'fixed']
      const mode = data.modes.includes(left.measurementMode) ? left.measurementMode : data.modes[0]
      const strategy = data.strategies.includes(left.strategy)
        ? left.strategy
        : fallbacks.find(s => data.strategies.includes(s)) ?? data.strategies[0]
      const cell = data.cells[`${strategy}|${mode}`]
      if (cell?.worst_box) {
        setSharedBoxLocation({ lat: cell.worst_box.lat, lon: cell.worst_box.lon })
      }
    } catch (e) {
      console.error('Adversarial data unavailable:', e)
    }
  }, [left.strategy, left.measurementMode, setSharedBoxLocation])

  const races = useRaces()

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
            <>
              <button className={styles.regenBtn} onClick={() => setSharedBoxLocation(randomConusPoint())} title="Random target">↻</button>
              <button className={styles.adversarialBtn} onClick={seedAdversarial} title="Use hardest box for Config A's strategy">ADVERSARIAL</button>
            </>
          )}
          {bothComplete && <VerdictBadge left={left} right={right} />}
          {bothComplete && maxHistory > 1 && (
            <div className={styles.inlineScrub}>
              <span className={styles.scrubLabel}>W{(scrubStep ?? maxHistory - 1) + 1}</span>
              <input
                type="range" min={0} max={maxHistory - 1}
                value={scrubStep ?? maxHistory - 1}
                onChange={(e) => setScrubStep(Number(e.target.value))}
                className={styles.scrubber}
              />
              <button
                className={styles.scrubReset}
                onClick={() => setScrubStep(undefined)}
                style={{ opacity: scrubStep === undefined ? 0.35 : 1 }}
              >END</button>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          {!locked && !races.running && (
            <>
              <button className={styles.btnPrimary} onClick={handleStart} disabled={loading}>
                {loading ? 'INIT...' : '▶ LAUNCH BOTH'}
              </button>
              <button
                className={styles.btnSecondary}
                onClick={() => races.run(left.strategy, left.measurementMode, right.strategy, right.measurementMode, 5)}
              >RUN 5 RACES</button>
            </>
          )}
          {races.running && (
            <button className={styles.btnAmber} onClick={races.abort}>{races.done}/{races.total} STOP</button>
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
              <button className={styles.btnAmber} onClick={stopAutoPlay}>PAUSE</button>
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
        <CompareMapPanel slice={left}  label="CONFIG A" accentColor="#00bcd4" stepIndex={scrubStep} targetLocation={sharedBoxLocation} />
        <div className={styles.mapDivider} />
        <CompareMapPanel slice={right} label="CONFIG B" accentColor="#ffab00" stepIndex={scrubStep} targetLocation={sharedBoxLocation} />

        {bothComplete && (
          <ResultWindow
            left={left} right={right}
            scrubStep={scrubStep} maxHistory={maxHistory}
            onScrub={setScrubStep}
          />
        )}
        {(races.results.length > 0 || races.running) && (
          <ScoreboardWindow
            results={races.results}
            done={races.done}
            total={races.total}
            running={races.running}
            onReset={races.reset}
          />
        )}
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

function ScoreboardWindow({ results, done, total, running, onReset }: {
  results: RaceResult[]; done: number; total: number; running: boolean; onReset: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const aWins   = results.filter(r => r.winner === 'A').length
  const bWins   = results.filter(r => r.winner === 'B').length
  const ties    = results.filter(r => r.winner === 'tied').length
  const avgA    = results.length ? (results.reduce((s, r) => s + r.aWeeks, 0) / results.length).toFixed(1) : '—'
  const avgB    = results.length ? (results.reduce((s, r) => s + r.bWeeks, 0) / results.length).toFixed(1) : '—'

  return (
    <div className={`${styles.floatWindow} ${styles.floatWindowRight}`}>
      <div className={styles.floatHead} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.floatArrow}>{collapsed ? '▶' : '▼'}</span>
        <span className={styles.floatTitle}>SCOREBOARD</span>
        <span className={styles.floatWeek} style={{ color: running ? 'var(--amber)' : 'var(--green)' }}>
          {running ? `${done}/${total}` : `${done} RACES`}
        </span>
        {!running && <button className={styles.scrubReset} onClick={(e) => { e.stopPropagation(); onReset() }}>CLR</button>}
      </div>
      {!collapsed && (
        <div className={styles.scoreBody}>
          {/* Tally row */}
          <div className={styles.tallyRow}>
            <div className={styles.tallyBlock} style={{ color: '#00bcd4' }}>
              <span className={styles.tallyNum}>{aWins}</span>
              <span className={styles.tallyLbl}>A WINS</span>
            </div>
            <div className={styles.tallyBlock} style={{ color: 'var(--text-muted)' }}>
              <span className={styles.tallyNum}>{ties}</span>
              <span className={styles.tallyLbl}>TIED</span>
            </div>
            <div className={styles.tallyBlock} style={{ color: '#ffab00' }}>
              <span className={styles.tallyNum}>{bWins}</span>
              <span className={styles.tallyLbl}>B WINS</span>
            </div>
          </div>

          {/* Win-rate bar */}
          {results.length > 0 && (
            <div className={styles.tallyBarWrap}>
              <div className={styles.tallyBar}>
                <div style={{ width: `${(aWins / results.length) * 100}%`, background: '#00bcd4' }} />
                <div style={{ width: `${(ties  / results.length) * 100}%`, background: 'var(--border-bright)' }} />
                <div style={{ width: `${(bWins / results.length) * 100}%`, background: '#ffab00' }} />
              </div>
            </div>
          )}

          {/* Per-race log */}
          <div className={styles.raceLog}>
            {results.map((r, i) => (
              <div key={i} className={styles.raceRow}>
                <span className={styles.raceNum}>R{i + 1}</span>
                <span className={styles.raceWinner} style={{
                  color: r.winner === 'A' ? '#00bcd4' : r.winner === 'B' ? '#ffab00' : 'var(--text-muted)'
                }}>
                  {r.winner === 'tied' ? 'TIED' : `${r.winner} WINS`}
                </span>
                <span className={styles.raceWeeks} style={{ color: '#00bcd4' }}>W{r.aWeeks}</span>
                <span className={styles.raceVs}>vs</span>
                <span className={styles.raceWeeks} style={{ color: '#ffab00' }}>W{r.bWeeks}</span>
              </div>
            ))}
            {running && done < total && (
              <div className={styles.raceRow}>
                <span className={styles.raceNum}>R{done + 1}</span>
                <span className={styles.racePending}>running…</span>
              </div>
            )}
          </div>

          {/* Averages */}
          {results.length > 0 && (
            <div className={styles.avgRow}>
              <span className={styles.avgLabel}>AVG WKS</span>
              <span style={{ color: '#00bcd4' }}>{avgA}</span>
              <span className={styles.raceVs}>vs</span>
              <span style={{ color: '#ffab00' }}>{avgB}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultWindow({ left, right, scrubStep, maxHistory, onScrub }: {
  left: CompareSlice; right: CompareSlice
  scrubStep: number | undefined; maxHistory: number
  onScrub: (i: number | undefined) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const currentIdx = scrubStep ?? maxHistory - 1

  return (
    <div className={styles.floatWindow}>
      <div className={styles.floatHead} onClick={() => setCollapsed(c => !c)}>
        <span className={styles.floatArrow}>{collapsed ? '▶' : '▼'}</span>
        <span className={styles.floatTitle}>CONVERGENCE</span>
        <span className={styles.floatWeek}>W{currentIdx + 1}</span>
      </div>
      {!collapsed && (
        <div className={styles.floatBody}>
          <ConvergenceChart left={left} right={right} scrubStep={scrubStep} />
        </div>
      )}
    </div>
  )
}

const LOG_MIN = Math.log10(0.5)
const LOG_MAX = Math.log10(2000)

function ConvergenceChart({ left, right, scrubStep }: {
  left: CompareSlice; right: CompareSlice; scrubStep: number | undefined
}) {
  const W = 100  // viewBox width (%)
  const H = 80   // viewBox height px

  const toY = (r: number) => {
    const v = Math.max(r, 0.5)
    return H - ((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * H
  }

  const makePath = (slice: CompareSlice) => {
    const n = slice.history.length
    if (n < 2) return ''
    return slice.history.map((s, i) =>
      `${i === 0 ? 'M' : 'L'}${((i / (n - 1)) * 100).toFixed(2)} ${toY(s.uncertainty_radius).toFixed(2)}`
    ).join(' ')
  }

  const cursorX = scrubStep !== undefined
    ? ((scrubStep / Math.max(Math.max(left.history.length, right.history.length) - 1, 1)) * 100).toFixed(2)
    : null

  const threshY = toY(5)
  const gridVals = [1000, 100, 10, 1]
  const xLabels = [0, 13, 26, 39, 52]

  return (
    <div className={styles.chartOuter}>
      <div className={styles.chartWrap}>
        {/* Y-axis */}
        <div className={styles.chartYAxis}>
          <span className={styles.chartYUnit}>mi</span>
          {gridVals.map(v => (
            <span key={v} className={styles.chartYLabel} style={{ bottom: `${((Math.log10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100}%` }}>
              {v}
            </span>
          ))}
          <span className={styles.chartYLabel5} style={{ bottom: `${((Math.log10(5) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100}%` }}>5</span>
        </div>
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className={styles.chartSvg}>
          {/* horizontal grid lines */}
          {gridVals.map(v => (
            <line key={v} x1="0" y1={toY(v)} x2="100" y2={toY(v)}
              stroke={v === 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.12)'}
              strokeWidth={v === 1 ? '0.8' : '0.5'} />
          ))}
          <line x1="0" y1={threshY} x2="100" y2={threshY} stroke="rgba(255,80,80,0.8)" strokeWidth="0.8" strokeDasharray="2,2" />
          {/* bottom baseline */}
          <line x1="0" y1={H} x2="100" y2={H} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
          {/* curves */}
          <path d={makePath(left)}  fill="none" stroke="#00bcd4" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          <path d={makePath(right)} fill="none" stroke="#ffab00" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          {/* scrubber cursor */}
          {cursorX !== null && (
            <line x1={cursorX} y1="0" x2={cursorX} y2={H} stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <div className={styles.chartLegend}>
          <span style={{ color: '#00bcd4' }}>— A</span>
          <span style={{ color: '#ffab00' }}>— B</span>
          <span style={{ color: 'rgba(255,61,61,0.85)' }}>— 5mi</span>
        </div>
      </div>
      {/* X-axis week labels */}
      <div className={styles.chartXAxis}>
        {xLabels.map(w => (
          <span key={w} className={styles.chartXLabel} style={{ left: `${(w / 52) * 100}%` }}>
            W{w}
          </span>
        ))}
      </div>
    </div>
  )
}

function VerdictBadge({ left, right }: { left: CompareSlice; right: CompareSlice }) {
  const aWeeks = left.history.find(s => s.localized)?.week ?? null
  const bWeeks = right.history.find(s => s.localized)?.week ?? null
  const aw = aWeeks ?? 52, bw = bWeeks ?? 52
  const delta = Math.abs(aw - bw)
  const winner = aWeeks === null && bWeeks === null ? null
    : aWeeks === null ? 'B' : bWeeks === null ? 'A'
    : aw < bw ? 'A' : bw < aw ? 'B' : null

  return (
    <div className={styles.verdictBadge}>
      <span className={styles.sep}>│</span>
      {winner === 'A' && <><span style={{ color: '#00bcd4' }}>A</span>{' WINS'}</>}
      {winner === 'B' && <><span style={{ color: '#ffab00' }}>B</span>{' WINS'}</>}
      {winner === null && <span>TIED</span>}
      {delta > 0 && <span className={styles.verdictDelta}>by {delta}wk</span>}
    </div>
  )
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
