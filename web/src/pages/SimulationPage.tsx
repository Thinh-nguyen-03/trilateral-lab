import { SimulationMap } from '../components/map/SimulationMap'
import { StrategyModeForm } from '../components/simulation/StrategyModeForm'
import { StepControls } from '../components/simulation/StepControls'
import { SimulationPanel } from '../components/simulation/SimulationPanel'
import styles from './SimulationPage.module.css'

export function SimulationPage() {
  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarInner}>
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Configuration</h2>
            <StrategyModeForm />
          </section>

          <section className={styles.section}>
            <StepControls />
          </section>

          <SimulationPanel />
        </div>
      </aside>

      <div className={styles.mapContainer}>
        <SimulationMap />
      </div>
    </div>
  )
}
