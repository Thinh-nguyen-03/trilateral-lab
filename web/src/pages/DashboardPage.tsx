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
    return <div className={styles.error}>Failed to load results. Is the API running?</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h1 className={styles.heading}>Simulation Results</h1>
        <p className={styles.desc}>
          5 strategies × 6 measurement modes = 30 configurations, 500 trials each.
          A box is hidden in the continental US; each week you pick a location and learn
          the distance. Goal: localize within 5 miles.
        </p>
      </div>

      <ChartContainer
        title="Failure rate by strategy and measurement mode"
        subtitle="% of trials that hit the 52-week timeout without localizing within 5 miles"
        isLoading={isLoading}
        height={320}
      >
        {rows && <FailureHeatmap rows={rows} />}
      </ChartContainer>

      <ChartContainer
        title="Mean weeks to localize"
        subtitle="Includes 2-week ground search penalty. Timed-out trials count as 52 weeks."
        isLoading={isLoading}
        height={320}
      >
        {rows && <MeanWeeksHeatmap rows={rows} />}
      </ChartContainer>

      <ChartContainer
        title="Failure rate across measurement modes"
        subtitle="How each strategy degrades as precision gets worse. Click legend items to isolate."
        isLoading={isLoading}
        height={420}
      >
        {rows && <FailureByModeLine rows={rows} />}
      </ChartContainer>

      <ChartContainer
        title="How much does strategy choice matter?"
        subtitle="Large bar = strategy is the deciding factor. Small bar = noise level dominates."
        isLoading={isLoading}
        height={380}
      >
        {rows && <StrategySpreadBar rows={rows} />}
      </ChartContainer>

      <ChartContainer
        title="Distribution of weeks to localize"
        subtitle="Median shows the typical case. P90 ≥ 52 means at least 10% of trials timed out."
        isLoading={isLoading}
        height={340}
      >
        {rows && <MedianP90Heatmap rows={rows} />}
      </ChartContainer>
    </div>
  )
}
