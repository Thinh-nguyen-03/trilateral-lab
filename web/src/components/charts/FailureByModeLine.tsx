import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER } from '../../api/results'
import { DARK_LAYOUT, BLOOMBERG_COLORS, MONO, AXIS } from './chartTheme'

const STRATEGY_LABELS: Record<string, string> = {
  fixed:             'FIXED',
  random:            'RANDOM',
  max_separation:    'MAX-SEP',
  centroid:          'CENTROID',
  info_gain:         'INFO-GAIN*',
  entropy_gradient:  'ENTROPY*',
}

const MODE_LABELS = ['EXACT', 'RND ±10mi', 'RND ±25mi', 'RND ±100mi', 'GAUSS σ5', 'GAUSS σ25']

interface Props { rows: ResultRow[] }

export function FailureByModeLine({ rows }: Props) {
  const traces: Plotly.Data[] = STRATEGY_ORDER.map((strategy, i) => {
    const subset = rows.filter((r) => r.strategy === strategy)
    const byMode = Object.fromEntries(subset.map((r) => [r.mode, r]))
    const y     = MODE_ORDER.map((m) => byMode[m]?.failure_rate ?? null)
    const meanW = MODE_ORDER.map((m) => byMode[m]?.mean ?? null)
    const p90   = MODE_ORDER.map((m) => byMode[m]?.p90 ?? null)

    return {
      type: 'scatter',
      x: MODE_LABELS,
      y,
      name: STRATEGY_LABELS[strategy],
      mode: 'lines+markers',
      line: {
        color: BLOOMBERG_COLORS[i],
        width: 1.5,
        dash: (strategy === 'info_gain' || strategy === 'entropy_gradient') ? 'dot' : 'solid',
      },
      marker: { size: 5 },
      customdata: meanW.map((m, j) => [m, p90[j]]),
      hovertemplate:
        `<b>${STRATEGY_LABELS[strategy]} / %{x}</b><br>` +
        'FAIL: %{y:.1%}<br>' +
        'MEAN: %{customdata[0]:.1f}w  P90: %{customdata[1]:.0f}w<extra></extra>',
    } as Plotly.Data
  })

  return (
    <Plot
      data={traces}
      layout={{
        ...DARK_LAYOUT,
        xaxis: {
          type: 'category',
          ticks: '',
          title: { text: 'MEASUREMENT MODE  →  INCREASING NOISE', font: AXIS.titleFont },
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
        },
        yaxis: {
          title: { text: 'FAILURE RATE', font: AXIS.titleFont },
          tickformat: '.0%',
          range: [-0.02, 1.05],
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
        height: 360,
        margin: { l: 58, r: 20, t: 12, b: 60 },
        annotations: [{
          text: '* Info-Gain / Entropy-Grad: slow strategies (~300ms/step), dotted line',
          xref: 'paper', yref: 'paper', x: 0, y: -0.18,
          showarrow: false,
          font: { size: 11, family: MONO, color: '#a0a0a0' },
          align: 'left',
        }],
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
