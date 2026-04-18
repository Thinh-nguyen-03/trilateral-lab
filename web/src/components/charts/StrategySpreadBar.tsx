import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER } from '../../api/results'
import { DARK_LAYOUT, MONO, AXIS } from './chartTheme'

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

export function StrategySpreadBar({ rows }: Props) {
  const spreads = MODE_ORDER.map((mode, i) => {
    const subset = rows.filter((r) => r.mode === mode)
    const rates  = STRATEGY_ORDER.map((s) => subset.find((r) => r.strategy === s)?.failure_rate ?? 0)
    const best   = Math.min(...rates)
    const worst  = Math.max(...rates)
    return {
      label:      MODE_LABELS[i],
      spread:     worst - best,
      best,
      worst,
      bestLabel:  STRATEGY_LABELS[STRATEGY_ORDER[rates.indexOf(best)]] ?? '',
      worstLabel: STRATEGY_LABELS[STRATEGY_ORDER[rates.indexOf(worst)]] ?? '',
    }
  })

  return (
    <Plot
      data={[{
        type: 'bar',
        x: spreads.map((s) => s.label),
        y: spreads.map((s) => s.spread),
        marker: {
          color: spreads.map((s) => s.spread),
          colorscale: [[0, '#1a6e30'], [0.4, '#c8901a'], [1, '#8b1a1a']],
          showscale: true,
          colorbar: {
            title: { text: 'SPREAD', font: { family: MONO, size: 11, color: '#d8d8d8' } },
            tickformat: '.0%',
            tickfont: { family: MONO, size: 11, color: '#d8d8d8' },
            thickness: 12,
          },
        },
        customdata: spreads.map((s) => [s.best, s.worst, s.bestLabel, s.worstLabel]),
        hovertemplate:
          '<b>%{x}</b><br>' +
          'SPREAD: %{y:.0%}<br>' +
          'BEST: %{customdata[2]} (%{customdata[0]:.0%})<br>' +
          'WORST: %{customdata[3]} (%{customdata[1]:.0%})' +
          '<extra></extra>',
        text: spreads.map((s) => `${(s.spread * 100).toFixed(0)}%`),
        textposition: 'outside',
        textfont: { family: MONO, size: 11, color: '#c8c8c8' },
      } as Plotly.Data]}
      layout={{
        ...DARK_LAYOUT,
        xaxis: {
          type: 'category',
          ticks: '',
          color: AXIS.color,
          tickfont: AXIS.tickfont,
          gridcolor: AXIS.gridcolor,
        },
        yaxis: {
          title: { text: 'MAX − MIN FAILURE RATE', font: AXIS.titleFont },
          tickformat: '.0%',
          range: [0, 1.1],
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          ticks: '',
        },
        height: 310,
        bargap: 0.3,
        showlegend: false,
        margin: { l: 58, r: 80, t: 12, b: 48 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
