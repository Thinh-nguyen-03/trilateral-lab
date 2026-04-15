import Plot from 'react-plotly.js'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER } from '../../api/results'
import { pivotOn } from '../../api/results'
import { DARK_LAYOUT, FAILURE_COLORSCALE } from './chartTheme'

const STRATEGY_LABELS = ['Fixed', 'Random', 'Max-Sep', 'Centroid', 'Info-Gain*']
const MODE_LABELS = ['Exact', 'Round 10mi', 'Round 25mi', 'Round 100mi', 'Gaussian σ=5', 'Gaussian σ=25']

interface Props {
  rows: ResultRow[]
}

export function FailureHeatmap({ rows }: Props) {
  const z = pivotOn(rows, 'failure_rate', STRATEGY_ORDER, MODE_ORDER)
  const meanZ = pivotOn(rows, 'mean', STRATEGY_ORDER, MODE_ORDER)

  const text = z.map((row) => row.map((v) => `${(v * 100).toFixed(0)}%`))
  const customdata = meanZ

  return (
    <Plot
      data={[{
        type: 'heatmap',
        z,
        x: MODE_LABELS,
        y: STRATEGY_LABELS,
        text,
        texttemplate: '%{text}',
        textfont: { size: 13 },
        customdata,
        hovertemplate: '<b>%{y} / %{x}</b><br>Failure rate: %{z:.1%}<br>Mean weeks: %{customdata:.1f}<extra></extra>',
        colorscale: FAILURE_COLORSCALE,
        zmin: 0,
        zmax: 1,
        colorbar: { title: { text: 'Failure rate' }, tickformat: '.0%' },
      } as Plotly.Data]}
      layout={{
        ...DARK_LAYOUT,
        xaxis: { title: { text: 'Measurement mode' }, side: 'bottom' },
        yaxis: { title: { text: 'Strategy' }, autorange: 'reversed' },
        height: 320,
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
