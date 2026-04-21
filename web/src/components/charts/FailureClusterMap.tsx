import Plot from '../../lib/Plot'
import type { FailureClusterData } from '../../api/failureClusters'
import { DARK_LAYOUT, AXIS, MONO, BLOOMBERG_COLORS } from './chartTheme'

const STRATEGY_LABELS: Record<string, string> = {
  fixed:          'FIXED',
  random:         'RANDOM',
  max_separation: 'MAX-SEP',
  centroid:       'CENTROID',
  info_gain:      'INFO-GAIN',
  adaptive:       'ADAPTIVE',
}

interface Props {
  data:     FailureClusterData
  strategy: string
  mode:     string
}

export function FailureClusterMap({ data, strategy, mode }: Props) {
  const key = `${strategy}|${mode}`
  const cell = data.cells[key]
  const label = STRATEGY_LABELS[strategy] ?? strategy

  if (!cell || cell.n_failures === 0) {
    return (
      <div style={{ padding: 20, color: '#7da46a', fontFamily: MONO, fontSize: 12 }}>
        NO FAILURES FOR {label} / {mode} — {data.n_trials_per_config} TRIALS, ALL LOCALIZED.
      </div>
    )
  }

  const traces: Plotly.Data[] = []
  const totalFailures = cell.n_failures

  cell.clusters.forEach((c, i) => {
    const color = BLOOMBERG_COLORS[i % BLOOMBERG_COLORS.length]
    const share = totalFailures > 0 ? (c.count / totalFailures) * 100 : 0

    if (c.hull.length >= 3) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: c.hull.map((p) => p[0]),
        y: c.hull.map((p) => p[1]),
        fill: 'toself',
        fillcolor: color + '33',
        line: { color, width: 1.4 },
        hoverinfo: 'skip',
        showlegend: false,
      })
    }

    traces.push({
      type: 'scatter',
      mode: 'markers+text',
      x: [c.centroid_lon],
      y: [c.centroid_lat],
      marker: { color, size: Math.max(8, Math.min(22, 6 + Math.sqrt(c.count))), symbol: 'x' },
      text: [`C${i + 1}`],
      textposition: 'top center',
      textfont: { family: MONO, size: 9, color },
      hovertemplate:
        `<b>CLUSTER ${i + 1}</b><br>` +
        `${c.count} FAILURES (${share.toFixed(1)}%)<br>` +
        `LAT: %{y:.2f}°N<br>LON: %{x:.2f}°<extra></extra>`,
      showlegend: false,
    })
  })

  return (
    <Plot
      data={traces}
      layout={{
        ...DARK_LAYOUT,
        xaxis: {
          title: { text: 'LONGITUDE', font: AXIS.titleFont },
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          range: [-126, -65],
        },
        yaxis: {
          title: { text: 'LATITUDE', font: AXIS.titleFont },
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          range: [24, 50],
          scaleanchor: 'x',
          scaleratio: 1.3,
        },
        height: 380,
        margin: { l: 58, r: 20, t: 34, b: 52 },
        annotations: [{
          x: 0.5, y: 1.02, xref: 'paper', yref: 'paper',
          text: `${label} / ${mode} · ${totalFailures} FAILURES / ${data.n_trials_per_config} TRIALS`,
          showarrow: false,
          font: { family: MONO, size: 14, color: '#e8eaed' },
          xanchor: 'center',
          yanchor: 'bottom',
        }],
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
