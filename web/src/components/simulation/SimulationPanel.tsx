import { useSimulationStore } from '../../store/simulationStore'
import { useResults } from '../../hooks/useResults'
import { WeekTimeline } from './WeekTimeline'
import styles from './SimulationPanel.module.css'

export function SimulationPanel() {
  const { currentStep, status, boxLocation, strategy, measurementMode } = useSimulationStore()
  const { data: results } = useResults()
  const isManualComplete = strategy === 'manual' && status === 'complete' && currentStep != null

  return (
    <div className={styles.panel}>
      {/* ── Telemetry grid ── */}
      {currentStep ? (
        <div className={styles.grid}>
          <Cell label="WEEK" value={String(currentStep.week)} unit="/ 52" />
          <Cell
            label="UNCERTAINTY"
            value={
              currentStep.uncertainty_radius === Infinity
                ? '—'
                : currentStep.uncertainty_radius.toFixed(1)
            }
            unit="mi"
            highlight={currentStep.uncertainty_radius <= 5}
          />
          {currentStep.best_estimate && (
            <>
              <Cell label="EST. LAT" value={currentStep.best_estimate.lat.toFixed(3)} unit="°N" />
              <Cell label="EST. LON" value={Math.abs(currentStep.best_estimate.lon).toFixed(3)} unit="°W" />
            </>
          )}
        </div>
      ) : (
        <div className={styles.await}>
          <span className={styles.awaitGlyph}>--</span>
          <span>AWAITING TRIAL DATA</span>
        </div>
      )}

      {/* ── Complete banner ── */}
      {status === 'complete' && (
        <div className={currentStep?.localized ? styles.bannerOk : styles.bannerFail}>
          <span className={styles.bannerIcon}>{currentStep?.localized ? 'OK' : 'XX'}</span>
          <div>
            <div className={styles.bannerMain}>
              {currentStep?.localized
                ? `LOCALIZED  //  W${currentStep.week}`
                : 'TIMEOUT  //  W52'}
            </div>
            {boxLocation && (
              <div className={styles.bannerSub}>
                BOX  {boxLocation.lat.toFixed(3)}°N  {Math.abs(boxLocation.lon).toFixed(3)}°W
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Benchmark vs strategies (manual mode only) ── */}
      {isManualComplete && results && (
        <ManualBenchmark
          userWeeks={currentStep!.localized ? currentStep!.week : null}
          mode={measurementMode}
          results={results}
        />
      )}

      {/* ── Step log ── */}
      <div className={styles.section}>
        <SectionHead
          label="STEP LOG"
          right={currentStep ? `${currentStep.week} ENTRIES` : undefined}
        />
        <WeekTimeline />
      </div>
    </div>
  )
}

function Cell({
  label, value, unit, highlight,
}: {
  label: string; value: string; unit?: string; highlight?: boolean
}) {
  return (
    <div className={`${styles.cell} ${highlight ? styles.cellGreen : ''}`}>
      <span className={styles.cellLabel}>{label}</span>
      <div className={styles.cellRow}>
        <span className={styles.cellVal}>{value}</span>
        {unit && <span className={styles.cellUnit}>{unit}</span>}
      </div>
    </div>
  )
}

function SectionHead({ label, right }: { label: string; right?: string }) {
  return (
    <div className={styles.sectionHead}>
      <span className={styles.sectionLabel}>{label}</span>
      {right && <span className={styles.sectionRight}>{right}</span>}
    </div>
  )
}

interface BenchmarkProps {
  userWeeks: number | null
  mode: string
  results: ReturnType<typeof useResults>['data']
}

function ManualBenchmark({ userWeeks, mode, results }: BenchmarkProps) {
  if (!results) return null
  const maxSep   = results.find((r) => r.strategy === 'max_separation' && r.mode === mode)
  const infoGain = results.find((r) => r.strategy === 'info_gain'       && r.mode === mode)
  if (!maxSep && !infoGain) return null

  // User's displayed weeks: null → "TIMEOUT" (treated as 52+ for comparison)
  const effectiveUser = userWeeks ?? 52

  const verdict = (() => {
    if (userWeeks == null) return { text: 'TIMEOUT — BOTH STRATEGIES LOCALIZED ON AVERAGE', tone: 'loss' }
    const benchmarks = [maxSep?.mean, infoGain?.mean].filter((v): v is number => v != null)
    if (benchmarks.length === 0) return null
    const best = Math.min(...benchmarks)
    if (effectiveUser < best * 0.9)       return { text: 'YOU BEAT THE BEST STRATEGY',      tone: 'win'  }
    if (effectiveUser < best * 1.15)      return { text: 'COMPETITIVE WITH BEST STRATEGY',  tone: 'mid'  }
    return { text: 'BOTH STRATEGIES WOULD LOCALIZE FASTER ON AVERAGE', tone: 'loss' }
  })()

  const toneCls =
    verdict?.tone === 'win'  ? styles.benchmarkWin  :
    verdict?.tone === 'mid'  ? styles.benchmarkMid  :
                               styles.benchmarkLoss

  return (
    <div className={styles.benchmark}>
      <div className={styles.benchmarkHead}>BENCHMARK  //  {mode}</div>
      <div className={styles.benchmarkGrid}>
        <BenchmarkRow label="YOU"       value={userWeeks != null ? `W${userWeeks}` : 'TIMEOUT'} primary />
        {maxSep   && <BenchmarkRow label="MAX-SEP"   value={`W${maxSep.mean.toFixed(1)} μ   ${(maxSep.failure_rate*100).toFixed(0)}% fail`} />}
        {infoGain && <BenchmarkRow label="INFO-GAIN" value={`W${infoGain.mean.toFixed(1)} μ   ${(infoGain.failure_rate*100).toFixed(0)}% fail`} />}
      </div>
      {verdict && (
        <div className={`${styles.benchmarkVerdict} ${toneCls}`}>
          {verdict.text}
        </div>
      )}
    </div>
  )
}

function BenchmarkRow({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className={`${styles.benchmarkRow} ${primary ? styles.benchmarkRowPrimary : ''}`}>
      <span className={styles.benchmarkLabel}>{label}</span>
      <span className={styles.benchmarkValue}>{value}</span>
    </div>
  )
}
