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

export function EmpiricalCDF({ rows, mode }: Props) {
  const subset = rows.filter((r) => r.mode === mode && r.cdf_curve)

  if (subset.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 320,
        fontFamily: MONO,
        fontSize: 11,
        letterSpacing: '0.18em',
        color: '#888',
        padding: '0 32px',
        textAlign: 'center',
      }}>
        CDF DATA UNAVAILABLE — RE-RUN <code style={{ color: '#ffab00', marginLeft: 6 }}>python scripts/save_results.py</code>
      </div>
    )
  }

  const weeks = Array.from({ length: subset[0].cdf_curve!.length }, (_, i) => i + 1)

  const traces: Plotly.Data[] = STRATEGY_ORDER
    .map((strategy, i) => {
      const row = subset.find((r) => r.strategy === strategy)
      if (!row?.cdf_curve) return null
      return {
        type: 'scatter',
        x: weeks,
        y: row.cdf_curve,
        name: STRATEGY_LABELS[strategy] ?? strategy,
        mode: 'lines',
        line: {
          color: BLOOMBERG_COLORS[i],
          width: 1.7,
          shape: 'hv',
          dash: (strategy === 'info_gain' || strategy === 'entropy_gradient') ? 'dot' : 'solid',
        },
        hovertemplate: `<b>${STRATEGY_LABELS[strategy] ?? strategy}</b><br>By W%{x}: %{y:.1%} localized<extra></extra>`,
      } as Plotly.Data
    })
    .filter((t): t is Plotly.Data => t !== null)

  return (
    <Plot
      data={traces}
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
          title: { text: 'P(LOCALIZED BY WEEK)', font: AXIS.titleFont },
          range: [0, 1.02],
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          tickformat: '.0%',
          ticks: '',
        },
        legend: {
          font: { family: MONO, size: 12, color: '#d8d8d8' },
          bgcolor: 'rgba(8,8,8,0.94)',
          bordercolor: '#333',
          borderwidth: 1,
          x: 1, xanchor: 'right',
          y: 0, yanchor: 'bottom',
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
