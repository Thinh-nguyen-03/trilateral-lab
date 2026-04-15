import Plot from 'react-plotly.js'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER } from '../../api/results'
import { DARK_LAYOUT } from './chartTheme'

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

export function StrategySpreadBar({ rows }: Props) {
  const spreads = MODE_ORDER.map((mode) => {
    const subset = rows.filter((r) => r.mode === mode)
    const rates = STRATEGY_ORDER.map((s) => subset.find((r) => r.strategy === s)?.failure_rate ?? 0)
    const best = Math.min(...rates)
    const worst = Math.max(...rates)
    const bestStrategy = STRATEGY_ORDER[rates.indexOf(best)]
    const worstStrategy = STRATEGY_ORDER[rates.indexOf(worst)]
    return {
      spread: worst - best,
      best,
      worst,
      bestLabel: STRATEGY_LABELS[bestStrategy] ?? bestStrategy,
      worstLabel: STRATEGY_LABELS[worstStrategy] ?? worstStrategy,
    }
  })

  return (
    <Plot
      data={[{
        type: 'bar',
        x: MODE_LABELS,
        y: spreads.map((s) => s.spread),
        marker: {
          color: spreads.map((s) => s.spread),
          colorscale: [[0, '#a8d5b5'], [0.4, '#f4c04a'], [1, '#c0392b']],
          showscale: true,
          colorbar: { title: { text: 'Spread' }, tickformat: '.0%' },
        },
        customdata: spreads.map((s) => [s.best, s.worst, s.bestLabel, s.worstLabel]),
        hovertemplate:
          '<b>%{x}</b><br>' +
          'Strategy spread: %{y:.0%}<br>' +
          'Best: %{customdata[2]} (%{customdata[0]:.0%} fail)<br>' +
          'Worst: %{customdata[3]} (%{customdata[1]:.0%} fail)' +
          '<extra></extra>',
        text: spreads.map((s) => `${(s.spread * 100).toFixed(0)}%`),
        textposition: 'outside',
      } as Plotly.Data]}
      layout={{
        ...DARK_LAYOUT,
        xaxis: { title: { text: 'Measurement mode' }, color: '#ccc' },
        yaxis: { title: { text: 'Max − min failure rate across strategies' }, tickformat: '.0%', range: [0, 1.1], color: '#ccc', gridcolor: '#222' },
        height: 380,
        showlegend: false,
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
