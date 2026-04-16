import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER } from '../../api/results'
import { DARK_LAYOUT, PLOTLY_COLORS } from './chartTheme'

const STRATEGY_LABELS: Record<string, string> = {
  fixed: 'Fixed',
  random: 'Random',
  max_separation: 'Max-Sep',
  centroid: 'Centroid',
  info_gain: 'Info-Gain*',
}

const MODE_LABELS = ['Exact', 'Round 10mi', 'Round 25mi', 'Round 100mi', 'Gaussian σ=5', 'Gaussian σ=25']

interface Props {
  rows: ResultRow[]
}

export function FailureByModeLine({ rows }: Props) {
  const traces: Plotly.Data[] = STRATEGY_ORDER.map((strategy, i) => {
    const subset = rows.filter((r) => r.strategy === strategy)
    const byMode = Object.fromEntries(subset.map((r) => [r.mode, r]))

    const y = MODE_ORDER.map((m) => byMode[m]?.failure_rate ?? null)
    const meanW = MODE_ORDER.map((m) => byMode[m]?.mean ?? null)
    const p90 = MODE_ORDER.map((m) => byMode[m]?.p90 ?? null)

    return {
      type: 'scatter',
      x: MODE_LABELS,
      y,
      name: STRATEGY_LABELS[strategy],
      mode: 'lines+markers',
      line: {
        color: PLOTLY_COLORS[i],
        width: 2.5,
        dash: strategy === 'info_gain' ? 'dash' : 'solid',
      },
      marker: { size: 8 },
      customdata: meanW.map((m, j) => [m, p90[j]]),
      hovertemplate:
        `<b>${STRATEGY_LABELS[strategy]} / %{x}</b><br>` +
        'Failure: %{y:.1%}<br>' +
        'Mean: %{customdata[0]:.1f}w<br>' +
        'P90: %{customdata[1]:.0f}w<extra></extra>',
    } as Plotly.Data
  })

  return (
    <Plot
      data={traces}
      layout={{
        ...DARK_LAYOUT,
        xaxis: { title: { text: 'Measurement mode (increasing noise →)' }, color: '#ccc', gridcolor: '#222' },
        yaxis: { title: { text: 'Failure rate' }, tickformat: '.0%', range: [-0.02, 1.05], color: '#ccc', gridcolor: '#222' },
        legend: { title: { text: 'Strategy' }, bgcolor: 'rgba(20,20,20,0.9)', bordercolor: '#333', borderwidth: 1 },
        hovermode: 'x unified',
        height: 420,
        annotations: [{
          text: '* Info-Gain: 100 trials/mode (25 for Gaussian σ=25), dashed line',
          xref: 'paper', yref: 'paper', x: 0, y: -0.18,
          showarrow: false,
          font: { size: 10, color: '#666' },
          align: 'left',
        }],
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
