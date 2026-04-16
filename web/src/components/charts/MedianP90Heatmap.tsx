import Plot from 'react-plotly.js'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER, pivotOn } from '../../api/results'
import { DARK_LAYOUT, WEEKS_COLORSCALE } from './chartTheme'

const STRATEGY_LABELS = ['Fixed', 'Random', 'Max-Sep', 'Centroid', 'Info-Gain*']
const MODE_LABELS = ['Exact', 'Round 10mi', 'Round 25mi', 'Round 100mi', 'Gaussian σ=5', 'Gaussian σ=25']

interface Props {
  rows: ResultRow[]
}

export function MedianP90Heatmap({ rows }: Props) {
  const medianZ = pivotOn(rows, 'median', STRATEGY_ORDER, MODE_ORDER)
  const p90Z = pivotOn(rows, 'p90', STRATEGY_ORDER, MODE_ORDER)

  // Plotly's @types declares text as string | string[] but heatmap accepts string[][]; cast needed
  const makeText = (z: number[][]) =>
    z.map((row) => row.map((v) => `${v.toFixed(0)}`)) as unknown as string[]

  const sharedHeatmap = {
    type: 'heatmap' as const,
    x: MODE_LABELS,
    y: STRATEGY_LABELS,
    colorscale: WEEKS_COLORSCALE,
    zmin: 5,
    zmax: 52,
    textfont: { size: 11 },
    texttemplate: '%{text}',
  }

  return (
    <Plot
      data={[
        {
          ...sharedHeatmap,
          z: medianZ,
          text: makeText(medianZ),
          hovertemplate: '<b>%{y} / %{x}</b><br>Median: %{z:.0f} weeks<extra></extra>',
          showscale: false,
          xaxis: 'x',
          yaxis: 'y',
        } as Plotly.Data,
        {
          ...sharedHeatmap,
          z: p90Z,
          text: makeText(p90Z),
          hovertemplate: '<b>%{y} / %{x}</b><br>P90: %{z:.0f} weeks<extra></extra>',
          colorbar: { title: { text: 'Weeks' }, x: 1.02 },
          xaxis: 'x2',
          yaxis: 'y2',
        } as Plotly.Data,
      ]}
      layout={{
        ...DARK_LAYOUT,
        grid: { rows: 1, columns: 2, pattern: 'independent' },
        annotations: [
          { text: 'Median weeks', xref: 'paper', yref: 'paper', x: 0.22, y: 1.08, showarrow: false, font: { size: 13, color: '#ccc' } },
          { text: 'P90 weeks', xref: 'paper', yref: 'paper', x: 0.78, y: 1.08, showarrow: false, font: { size: 13, color: '#ccc' } },
        ],
        xaxis: { tickangle: 30, color: '#ccc' },
        yaxis: { autorange: 'reversed', color: '#ccc' },
        xaxis2: { tickangle: 30, color: '#ccc' },
        yaxis2: { autorange: 'reversed', color: '#ccc' },
        height: 340,
        margin: { l: 110, r: 110, t: 70, b: 80 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
