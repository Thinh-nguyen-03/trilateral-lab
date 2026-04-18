import { useState } from 'react'
import { useResults } from '../hooks/useResults'
import { ChartContainer } from '../components/charts/ChartContainer'
import { FailureHeatmap } from '../components/charts/FailureHeatmap'
import { MeanWeeksHeatmap } from '../components/charts/MeanWeeksHeatmap'
import { FailureByModeLine } from '../components/charts/FailureByModeLine'
import { StrategySpreadBar } from '../components/charts/StrategySpreadBar'
import { MedianP90Heatmap } from '../components/charts/MedianP90Heatmap'
import { ConvergenceCurves } from '../components/charts/ConvergenceCurves'
import { RegionalBreakdownBar } from '../components/charts/RegionalBreakdownBar'
import { ThresholdSensitivityChart } from '../components/charts/ThresholdSensitivityChart'
import styles from './DashboardPage.module.css'

const CONVERGENCE_MODES = [
  { value: 'EXACT',              label: 'EXACT' },
  { value: 'ROUND_10_MILES',     label: 'RND ±10mi' },
  { value: 'ROUND_25_MILES',     label: 'RND ±25mi' },
  { value: 'ROUND_100_MILES',    label: 'RND ±100mi' },
  { value: 'NOISY_GAUSSIAN_5',   label: 'GAUSS σ5' },
  { value: 'NOISY_GAUSSIAN_25',  label: 'GAUSS σ25' },
]

export function DashboardPage() {
  const { data: rows, isLoading, error } = useResults()
  const [convergenceMode, setConvergenceMode] = useState('EXACT')
  const [regionalMode, setRegionalMode] = useState('EXACT')
  const [thresholdMode, setThresholdMode] = useState('EXACT')

  if (error) {
    return (
      <div className={styles.error}>
        <span className={styles.errorIcon}>⚠</span>
        <span>DATASTREAM UNAVAILABLE — IS THE API RUNNING?</span>
      </div>
    )
  }

  return (
    <div className={styles.page}>

      {/* ── Terminal header ── */}
      <header className={styles.terminalBar}>
        <div className={styles.terminalLeft}>
          <span className={styles.terminalGlyph}>▐</span>
          <div>
            <div className={styles.terminalTitle}>TRILATERAL ANALYSIS TERMINAL</div>
            <div className={styles.terminalSub}>6 STRATEGIES · 6 SENSOR MODES · 500 TRIALS/CFG · 52-WEEK HORIZON</div>
          </div>
        </div>
        <div className={styles.statRow}>
          <Stat label="STRATEGIES"   value="6" />
          <Stat label="SENSOR MODES" value="6" />
          <Stat label="TRIALS / CFG" value="500" />
          <Stat label="THRESHOLD"    value="5 mi" />
          <Stat label="MAX WEEKS"    value="52" accent />
        </div>
      </header>

      {/* ── Section 01 – Failure and convergence heatmaps ── */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>01</span>
        <span className={styles.sectionTitle}>FAILURE &amp; CONVERGENCE MATRICES</span>
        <div className={styles.sectionRule} />
      </div>

      <div className={styles.grid}>
        <ChartContainer
          title="Failure rate by strategy × mode"
          subtitle="% of trials hitting the 52-week timeout without localizing within 5 mi"
          tag="FAIL %"
          isLoading={isLoading}
          height={300}
        >
          {rows && <FailureHeatmap rows={rows} />}
        </ChartContainer>

        <ChartContainer
          title="Mean weeks to localize"
          subtitle="2-week ground search penalty included. Timed-out trials counted as 52 weeks."
          tag="MEAN WKS"
          isLoading={isLoading}
          height={300}
        >
          {rows && <MeanWeeksHeatmap rows={rows} />}
        </ChartContainer>
      </div>

      {/* ── Section 02 – Strategy degradation ── */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>02</span>
        <span className={styles.sectionTitle}>STRATEGY DEGRADATION UNDER NOISE</span>
        <div className={styles.sectionRule} />
      </div>

      <div className={styles.grid}>
        <div className={styles.wide}>
          <ChartContainer
            title="Failure rate across measurement modes"
            subtitle="How each strategy degrades as sensor precision drops. Click legend to isolate a strategy."
            tag="LINE"
            isLoading={isLoading}
            height={360}
          >
            {rows && <FailureByModeLine rows={rows} />}
          </ChartContainer>
        </div>
      </div>

      {/* ── Section 03 – Impact and distribution ── */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>03</span>
        <span className={styles.sectionTitle}>IMPACT &amp; DISTRIBUTION ANALYSIS</span>
        <div className={styles.sectionRule} />
      </div>

      <div className={styles.grid}>
        <ChartContainer
          title="Strategy impact by sensor mode"
          subtitle="Spread between best and worst strategy per mode. Large bar = choice of strategy is decisive."
          tag="SPREAD"
          isLoading={isLoading}
          height={300}
        >
          {rows && <StrategySpreadBar rows={rows} />}
        </ChartContainer>

        <ChartContainer
          title="Distribution of weeks to localize"
          subtitle="Median = typical case. P90 ≥ 52 means at least 10% of trials timed out."
          tag="MED/P90"
          isLoading={isLoading}
          height={300}
        >
          {rows && <MedianP90Heatmap rows={rows} />}
        </ChartContainer>
      </div>

      {/* ── Section 04 – Convergence trajectories ── */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>04</span>
        <span className={styles.sectionTitle}>CONVERGENCE TRAJECTORIES</span>
        <div className={styles.sectionRule} />
      </div>

      <div className={styles.grid}>
        <div className={styles.wide}>
          <div className={styles.modeFilter}>
            {CONVERGENCE_MODES.map((m) => (
              <button
                key={m.value}
                className={`${styles.modeChip} ${convergenceMode === m.value ? styles.modeChipActive : ''}`}
                onClick={() => setConvergenceMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ChartContainer
            title="Median uncertainty radius over time"
            subtitle="How quickly each strategy narrows down the target. Log scale — 5 mi threshold marks localization."
            tag="CURVE"
            isLoading={isLoading}
            height={340}
          >
            {rows && <ConvergenceCurves rows={rows} mode={convergenceMode} />}
          </ChartContainer>
        </div>
      </div>

      {/* ── Section 05 – Geographic bias ── */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>05</span>
        <span className={styles.sectionTitle}>GEOGRAPHIC BIAS ANALYSIS</span>
        <div className={styles.sectionRule} />
      </div>

      <div className={styles.grid}>
        <div className={styles.wide}>
          <div className={styles.modeFilter}>
            {CONVERGENCE_MODES.map((m) => (
              <button
                key={m.value}
                className={`${styles.modeChip} ${regionalMode === m.value ? styles.modeChipActive : ''}`}
                onClick={() => setRegionalMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ChartContainer
            title="Failure rate by geographic region"
            subtitle="Continental US split into 5 regions (NW / SW / CENTRAL / NE / SE). Reveals spatial blind spots per strategy."
            tag="REGION"
            isLoading={isLoading}
            height={300}
          >
            {rows && <RegionalBreakdownBar rows={rows} mode={regionalMode} />}
          </ChartContainer>
        </div>
      </div>

      {/* ── Section 06 – Threshold sensitivity ── */}
      <div className={styles.sectionHead}>
        <span className={styles.sectionNum}>06</span>
        <span className={styles.sectionTitle}>LOCALIZATION THRESHOLD SENSITIVITY</span>
        <div className={styles.sectionRule} />
      </div>

      <div className={styles.grid}>
        <div className={styles.wide}>
          <div className={styles.modeFilter}>
            {CONVERGENCE_MODES.map((m) => (
              <button
                key={m.value}
                className={`${styles.modeChip} ${thresholdMode === m.value ? styles.modeChipActive : ''}`}
                onClick={() => setThresholdMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <ChartContainer
            title="Failure rate vs. localization threshold"
            subtitle="How mission success varies with ground-search radius. Thresholds: 2 / 5 / 10 / 15 / 25 mi."
            tag="THRESHOLD"
            isLoading={isLoading}
            height={320}
          >
            {rows && <ThresholdSensitivityChart rows={rows} mode={thresholdMode} />}
          </ChartContainer>
        </div>
      </div>

      <div className={styles.footer}>
        <span>TRI·LAT INTEL LAB</span>
        <span className={styles.footerSep}>·</span>
        <span>RESULTS ARCHIVE</span>
        <span className={styles.footerSep}>·</span>
        <span>ALL DATA SIMULATED</span>
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={styles.stat}>
      <span className={`${styles.statVal} ${accent ? styles.statValAmber : ''}`}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
