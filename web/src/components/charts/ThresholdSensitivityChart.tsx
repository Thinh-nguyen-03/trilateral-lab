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

const THRESHOLDS = [2, 5, 10, 15, 25]

interface Props {
  rows: ResultRow[]
  mode: string
}

export function ThresholdSensitivityChart({ rows, mode }: Props) {
  const subset = rows.filter((r) => r.mode === mode && r.threshold_stats)

  const traces: Plotly.Data[] = STRATEGY_ORDER
    .map((strategy, i) => {
      const row = subset.find((r) => r.strategy === strategy)
      if (!row?.threshold_stats) return null

      const y = THRESHOLDS.map((t) => {
        const key = `threshold_${t}`
        return row.threshold_stats![key]?.failure_rate ?? null
      })

      return {
        type:  'scatter',
        x:     THRESHOLDS,
        y,
        name:  STRATEGY_LABELS[strategy] ?? strategy,
        mode:  'lines+markers',
        line: {
          color: BLOOMBERG_COLORS[i],
          width: 1.5,
          dash: (strategy === 'info_gain' || strategy === 'entropy_gradient') ? 'dot' : 'solid',
        },
        marker: { size: 6 },
        hovertemplate:
          `<b>${STRATEGY_LABELS[strategy] ?? strategy}</b><br>` +
          'THRESHOLD: %{x} mi<br>FAIL: %{y:.1%}<extra></extra>',
      } as Plotly.Data
    })
    .filter((t): t is Plotly.Data => t !== null)

  return (
    <Plot
      data={traces}
      layout={{
        ...DARK_LAYOUT,
        xaxis: {
          title: { text: 'LOCALIZATION THRESHOLD (miles)', font: AXIS.titleFont },
          tickvals: THRESHOLDS,
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          ticks: '',
        },
        yaxis: {
          title: { text: 'FAILURE RATE', font: AXIS.titleFont },
          tickformat: '.0%',
          autorange: true,
          rangemode: 'tozero',
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
        height: 320,
        margin: { l: 58, r: 20, t: 12, b: 56 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
