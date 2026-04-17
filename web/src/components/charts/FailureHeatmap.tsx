import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER, pivotOn } from '../../api/results'
import { DARK_LAYOUT, FAILURE_COLORSCALE, MONO, AXIS } from './chartTheme'

const STRATEGY_LABELS = ['FIXED', 'RANDOM', 'MAX-SEP', 'CENTROID', 'INFO-GAIN*']
const MODE_LABELS = ['EXACT', 'RND ±10mi', 'RND ±25mi', 'RND ±100mi', 'GAUSS σ5', 'GAUSS σ25']

interface Props { rows: ResultRow[] }

export function FailureHeatmap({ rows }: Props) {
  const z     = pivotOn(rows, 'failure_rate', STRATEGY_ORDER, MODE_ORDER)
  const meanZ = pivotOn(rows, 'mean',         STRATEGY_ORDER, MODE_ORDER)
  const text  = z.map((row) => row.map((v) => `${(v * 100).toFixed(0)}%`)) as unknown as string[]

  return (
    <Plot
      data={[{
        type: 'heatmap',
        z,
        x: MODE_LABELS,
        y: STRATEGY_LABELS,
        text,
        texttemplate: '%{text}',
        textfont: { size: 12, family: MONO, color: '#f0f0f0' },
        customdata: meanZ,
        hovertemplate: '<b>%{y} / %{x}</b><br>Fail: %{z:.1%}<br>Mean: %{customdata:.1f}w<extra></extra>',
        colorscale: FAILURE_COLORSCALE,
        zmin: 0,
        zmax: 1,
        xgap: 2,
        ygap: 2,
        colorbar: {
          title: { text: 'FAIL RATE', font: { family: MONO, size: 11, color: '#d8d8d8' } },
          tickformat: '.0%',
          tickfont: { family: MONO, size: 11, color: '#d8d8d8' },
          dtick: 0.5,
          thickness: 12,
          len: 0.8,
        },
      } as Plotly.Data]}
      layout={{
        ...DARK_LAYOUT,
        xaxis: {
          type: 'category',
          ticks: 'outside',
          ticklen: 4,
          tickcolor: 'transparent',
          tickfont: AXIS.tickfont,
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
        },
        yaxis: {
          type: 'category',
          autorange: 'reversed',
          ticks: 'outside',
          ticklen: 4,
          tickcolor: 'transparent',
          tickfont: AXIS.tickfont,
          color: AXIS.color,
        },
        height: 310,
        margin: { l: 90, r: 96, t: 12, b: 56 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
