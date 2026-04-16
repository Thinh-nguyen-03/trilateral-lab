import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER, pivotOn } from '../../api/results'
import { DARK_LAYOUT, WEEKS_COLORSCALE } from './chartTheme'

const STRATEGY_LABELS = ['Fixed', 'Random', 'Max-Sep', 'Centroid', 'Info-Gain*']
const MODE_LABELS = ['Exact', 'Round 10mi', 'Round 25mi', 'Round 100mi', 'Gaussian σ=5', 'Gaussian σ=25']

interface Props {
  rows: ResultRow[]
}

export function MeanWeeksHeatmap({ rows }: Props) {
  const z = pivotOn(rows, 'mean', STRATEGY_ORDER, MODE_ORDER)
  const failZ = pivotOn(rows, 'failure_rate', STRATEGY_ORDER, MODE_ORDER)

  const text = z.map((row) => row.map((v) => `${v.toFixed(0)}w`)) as unknown as string[]

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
        customdata: failZ,
        hovertemplate: '<b>%{y} / %{x}</b><br>Mean weeks: %{z:.1f}<br>Failure rate: %{customdata:.1%}<extra></extra>',
        colorscale: WEEKS_COLORSCALE,
        zmin: 5,
        zmax: 52,
        colorbar: { title: { text: 'Mean weeks' } },
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
