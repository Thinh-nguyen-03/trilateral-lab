import Plot from '../../lib/Plot'
import { useSimulationStore } from '../../store/simulationStore'
import { DARK_LAYOUT, AXIS, MONO } from '../charts/chartTheme'

interface Props { height?: number; margin?: { l: number; r: number; t: number; b: number } }

export function ConvergenceChart({ height = 180, margin = { l: 54, r: 12, t: 8, b: 40 } }: Props) {
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
          line: { color: localized ? '#00e676' : '#ffab00', width: 1.5 },
          marker: { size: 3, color: localized ? '#00e676' : '#ffab00' },
          hovertemplate: 'W%{x}  %{y:.1f} mi<extra></extra>',
        },
        {
          type: 'scatter',
          x: [0, 52],
          y: [5, 5],
          mode: 'lines',
          line: { dash: 'dot', color: '#ff3d3d', width: 1 },
          hoverinfo: 'skip',
          showlegend: false,
        },
      ]}
      layout={{
        ...DARK_LAYOUT,
        plot_bgcolor: 'transparent',
        xaxis: {
          ...AXIS,
          tickfont: { ...AXIS.tickfont, size: 9 },
          title: { text: 'WEEK', font: { ...AXIS.titleFont, size: 9 } },
          dtick: 4,
          zeroline: false,
          zerolinecolor: AXIS.zerolinecolor,
        },
        yaxis: {
          ...AXIS,
          type: 'log' as const,
          tickfont: { ...AXIS.tickfont, size: 9 },
          title: { text: 'RADIUS (mi)', font: { ...AXIS.titleFont, size: 9 } },
          zeroline: false,
          zerolinecolor: AXIS.zerolinecolor,
        },
        height,
        margin,
        font: { family: MONO, color: AXIS.color, size: 9 },
        showlegend: false,
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
