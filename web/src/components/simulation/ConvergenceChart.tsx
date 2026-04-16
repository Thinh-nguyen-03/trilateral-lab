import Plot from '../../lib/Plot'
import { useSimulationStore } from '../../store/simulationStore'

export function ConvergenceChart() {
  const { history, status } = useSimulationStore()

  if (history.length === 0) return null

  const weeks = history.map((s) => s.week)
  const radii = history.map((s) => s.uncertainty_radius)
  const localized = status === 'complete' && history.at(-1)?.localized

  return (
    <Plot
      data={[
        {
          type: 'scatter',
          x: weeks,
          y: radii,
          mode: 'lines+markers',
          line: { color: localized ? '#22c55e' : '#4a90d9', width: 2 },
          marker: { size: 5 },
          hovertemplate: 'Week %{x}<br>Uncertainty: %{y:.1f} mi<extra></extra>',
        },
        {
          type: 'scatter',
          x: [0, 52],
          y: [5, 5],
          mode: 'lines',
          line: { dash: 'dot', color: '#ef4444', width: 1 },
          hoverinfo: 'skip',
          showlegend: false,
        },
      ]}
      layout={{
        paper_bgcolor: '#111',
        plot_bgcolor: '#111',
        xaxis: {
          title: { text: 'Week', font: { size: 11 } },
          color: '#666',
          gridcolor: '#1f1f1f',
          dtick: 2,
        },
        yaxis: {
          title: { text: 'Uncertainty (mi)', font: { size: 11 } },
          type: 'log',
          color: '#666',
          gridcolor: '#1f1f1f',
        },
        height: 185,
        margin: { l: 52, r: 12, t: 8, b: 42 },
        font: { family: 'Inter, system-ui, sans-serif', color: '#888', size: 11 },
        showlegend: false,
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
