import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER } from '../../api/results'
import { DARK_LAYOUT, BLOOMBERG_COLORS, MONO, AXIS } from './chartTheme'

const STRATEGY_LABELS: Record<string, string> = {
  fixed:             'FIXED',
  random:            'RANDOM',
  max_separation:    'MAX-SEP',
  centroid:          'CENTROID',
  info_gain:         'INFO-GAIN*',
  entropy_gradient:  'ENTROPY*',
}

const REGIONS = ['NW', 'SW', 'CENTRAL', 'NE', 'SE']

interface Props {
  rows: ResultRow[]
  mode: string
}

export function RegionalBreakdownBar({ rows, mode }: Props) {
  const subset = rows.filter((r) => r.mode === mode && r.regional_stats)

  const traces: Plotly.Data[] = STRATEGY_ORDER
    .map((strategy, i) => {
      const row = subset.find((r) => r.strategy === strategy)
      if (!row?.regional_stats) return null

      const y = REGIONS.map((region) => {
        const rs = row.regional_stats![region]
        return rs ? rs.failure_rate : null
      })

      return {
        type: 'bar',
        name: STRATEGY_LABELS[strategy] ?? strategy,
        x: REGIONS,
        y,
        marker: { color: BLOOMBERG_COLORS[i], opacity: 0.85 },
        hovertemplate:
          `<b>${STRATEGY_LABELS[strategy] ?? strategy} / %{x}</b><br>FAIL: %{y:.1%}<extra></extra>`,
      } as Plotly.Data
    })
    .filter((t): t is Plotly.Data => t !== null)

  return (
    <Plot
      data={traces}
      layout={{
        ...DARK_LAYOUT,
        barmode: 'group',
        xaxis: {
          type: 'category',
          title: { text: 'REGION', font: AXIS.titleFont },
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          ticks: '',
        },
        yaxis: {
          title: { text: 'FAILURE RATE', font: AXIS.titleFont },
          tickformat: '.0%',
          autorange: true,
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          ticks: '',
        },
        legend: {
          font: { family: MONO, size: 12, color: '#d8d8d8' },
          bgcolor: 'rgba(8,8,8,0.94)',
          bordercolor: '#333',
          borderwidth: 1,
          x: 1, xanchor: 'right',
          y: 1, yanchor: 'top',
        },
        bargap: 0.2,
        bargroupgap: 0.06,
        height: 300,
        margin: { l: 58, r: 20, t: 12, b: 52 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
