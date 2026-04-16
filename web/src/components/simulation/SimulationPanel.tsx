import { useSimulationStore } from '../../store/simulationStore'
import { WeekTimeline } from './WeekTimeline'
import { ConvergenceChart } from './ConvergenceChart'
import styles from './SimulationPanel.module.css'

export function SimulationPanel() {
  const { currentStep, status, boxLocation } = useSimulationStore()

  return (
    <div className={styles.panel}>
      {/* Stats row */}
      {currentStep && (
        <div className={styles.stats}>
          <Stat label="Week" value={String(currentStep.week)} />
          <Stat
            label="Uncertainty"
            value={
              currentStep.uncertainty_radius === Infinity
                ? '—'
                : `${currentStep.uncertainty_radius.toFixed(1)} mi`
            }
          />
          {currentStep.best_estimate && (
            <Stat
              label="Best estimate"
              value={`${currentStep.best_estimate.lat.toFixed(1)}°, ${currentStep.best_estimate.lon.toFixed(1)}°`}
            />
          )}
        </div>
      )}

      {/* Localized / timeout banner */}
      {status === 'complete' && (
        <div className={currentStep?.localized ? styles.successBanner : styles.failBanner}>
          {currentStep?.localized
            ? `Localized in ${currentStep.week} weeks`
            : 'Trial timed out (52 weeks)'}
          {boxLocation && (
            <span className={styles.boxCoords}>
              Box: {boxLocation.lat.toFixed(2)}°, {boxLocation.lon.toFixed(2)}°
            </span>
          )}
        </div>
      )}

      {/* Convergence chart */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Convergence</h3>
        <ConvergenceChart />
      </section>

      {/* Step timeline */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Steps</h3>
        <WeekTimeline />
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
    </div>
  )
}
