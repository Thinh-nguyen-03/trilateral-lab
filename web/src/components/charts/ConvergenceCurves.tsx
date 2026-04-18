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

interface Props {
  rows: ResultRow[]
  mode: string
}

export function ConvergenceCurves({ rows, mode }: Props) {
  const subset = rows.filter((r) => r.mode === mode && r.median_radius_curve)
  const weeks  = Array.from({ length: 52 }, (_, i) => i + 1)

  const traces: Plotly.Data[] = STRATEGY_ORDER
    .map((strategy, i) => {
      const row = subset.find((r) => r.strategy === strategy)
      if (!row?.median_radius_curve) return null
      return {
        type:   'scatter',
        x:      weeks,
        y:      row.median_radius_curve,
        name:   STRATEGY_LABELS[strategy] ?? strategy,
        mode:   'lines',
        line: {
          color: BLOOMBERG_COLORS[i],
          width: 1.5,
          dash: (strategy === 'info_gain' || strategy === 'entropy_gradient') ? 'dot' : 'solid',
        },
        hovertemplate: `<b>${STRATEGY_LABELS[strategy] ?? strategy}</b><br>W%{x}: %{y:.1f} mi<extra></extra>`,
      } as Plotly.Data
    })
    .filter((t): t is Plotly.Data => t !== null)

  return (
    <Plot
      data={[
        ...traces,
        // 5-mile localization threshold reference line
        {
          type:  'scatter',
          x:     [1, 52],
          y:     [5, 5],
          name:  '5 mi threshold',
          mode:  'lines',
          line:  { color: 'rgba(255,61,61,0.5)', width: 1, dash: 'dot' },
          hoverinfo: 'skip',
          showlegend: false,
        } as Plotly.Data,
      ]}
      layout={{
        ...DARK_LAYOUT,
        xaxis: {
          title: { text: 'WEEK', font: AXIS.titleFont },
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          dtick: 4,
          ticks: '',
        },
        yaxis: {
          title: { text: 'MEDIAN UNCERTAINTY RADIUS (mi)', font: AXIS.titleFont },
          type: 'log',
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
        hovermode: 'x unified',
        height: 340,
        margin: { l: 72, r: 20, t: 12, b: 68 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
