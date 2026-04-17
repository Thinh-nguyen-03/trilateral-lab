import { useSimulationStore } from '../../store/simulationStore'
import { WeekTimeline } from './WeekTimeline'
import styles from './SimulationPanel.module.css'

export function SimulationPanel() {
  const { currentStep, status, boxLocation } = useSimulationStore()

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
          <span className={styles.awaitGlyph}>◌</span>
          <span>AWAITING TRIAL DATA</span>
        </div>
      )}

      {/* ── Complete banner ── */}
      {status === 'complete' && (
        <div className={currentStep?.localized ? styles.bannerOk : styles.bannerFail}>
          <span className={styles.bannerIcon}>{currentStep?.localized ? '●' : '✕'}</span>
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
