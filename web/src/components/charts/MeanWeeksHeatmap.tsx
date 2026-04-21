import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER, pivotOn } from '../../api/results'
import { DARK_LAYOUT, WEEKS_COLORSCALE, MONO, AXIS } from './chartTheme'

const STRATEGY_LABELS = ['FIXED', 'RANDOM', 'MAX-SEP', 'CENTROID', 'INFO-GAIN*', 'ENTROPY*']
const MODE_LABELS = ['EXACT', 'RND ±10mi', 'RND ±25mi', 'RND ±100mi', 'GAUSS σ5', 'GAUSS σ25']

interface Props { rows: ResultRow[] }

export function MeanWeeksHeatmap({ rows }: Props) {
  const z     = pivotOn(rows, 'mean',         STRATEGY_ORDER, MODE_ORDER)
  const failZ = pivotOn(rows, 'failure_rate',  STRATEGY_ORDER, MODE_ORDER)
  const text  = z.map((row) => row.map((v) => `${v.toFixed(0)}w`)) as unknown as string[]

  const ciText = STRATEGY_ORDER.map((s) =>
    MODE_ORDER.map((m) => {
      const row = rows.find((r) => r.strategy === s && r.mode === m)
      const ci = row?.mean_ci
      return ci ? `[${ci[0].toFixed(1)} – ${ci[1].toFixed(1)}]` : '—'
    }),
  )
  const custom = failZ.map((row, i) => row.map((v, j) => [v, ciText[i][j]]))

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
        customdata: custom as unknown as Plotly.Datum[][],
        hovertemplate: '<b>%{y} / %{x}</b><br>Mean: %{z:.1f}w<br>95% CI: %{customdata[1]}<br>Fail: %{customdata[0]:.1%}<extra></extra>',
        colorscale: WEEKS_COLORSCALE,
        zmin: 5,
        zmax: 52,
        xgap: 2,
        ygap: 2,
        colorbar: {
          title: { text: 'MEAN WKS', font: { family: MONO, size: 11, color: '#d8d8d8' } },
          tickfont: { family: MONO, size: 11, color: '#d8d8d8' },
          dtick: 10,
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
