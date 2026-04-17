import { useResults } from '../hooks/useResults'
import { ChartContainer } from '../components/charts/ChartContainer'
import { FailureHeatmap } from '../components/charts/FailureHeatmap'
import { MeanWeeksHeatmap } from '../components/charts/MeanWeeksHeatmap'
import { FailureByModeLine } from '../components/charts/FailureByModeLine'
import { StrategySpreadBar } from '../components/charts/StrategySpreadBar'
import { MedianP90Heatmap } from '../components/charts/MedianP90Heatmap'
import styles from './DashboardPage.module.css'

export function DashboardPage() {
  const { data: rows, isLoading, error } = useResults()

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
            <div className={styles.terminalSub}>5 STRATEGIES · 6 SENSOR MODES · 500 TRIALS/CFG · 52-WEEK HORIZON</div>
          </div>
        </div>
        <div className={styles.statRow}>
          <Stat label="STRATEGIES"   value="5" />
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
