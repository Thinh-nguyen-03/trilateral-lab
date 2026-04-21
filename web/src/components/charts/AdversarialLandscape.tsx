import Plot from '../../lib/Plot'
import type { AdversarialData } from '../../api/adversarial'
import { DARK_LAYOUT, WEEKS_COLORSCALE, AXIS, MONO } from './chartTheme'

const STRATEGY_LABELS: Record<string, string> = {
  fixed:          'FIXED',
  random:         'RANDOM',
  max_separation: 'MAX-SEP',
  centroid:       'CENTROID',
  info_gain:      'INFO-GAIN',
}

interface Props {
  data:     AdversarialData
  strategy: string
  mode:     string
}

export function AdversarialLandscape({ data, strategy, mode }: Props) {
  const key = `${strategy}|${mode}`
  const cell = data.cells[key]
  if (!cell) {
    return <div style={{ padding: 16, color: '#f4b400', fontFamily: MONO }}>
      No adversarial data for {STRATEGY_LABELS[strategy] ?? strategy} / {mode}
    </div>
  }

  const label = STRATEGY_LABELS[strategy] ?? strategy

  const z = cell.mean_weeks.map((row) => row.map((v) => (v == null ? NaN : v)))

  const allVals: number[] = []
  for (const k of Object.keys(data.cells)) {
    for (const row of data.cells[k].mean_weeks) {
      for (const v of row) if (v != null) allVals.push(v)
    }
  }
  const zmin = Math.min(...allVals)
  const zmax = Math.max(...allVals)

  const worst = cell.worst_box
  const worstMarker: Plotly.Data | null = worst
    ? {
        type: 'scatter',
        mode: 'markers+text',
        x: [worst.lon],
        y: [worst.lat],
        marker: { color: '#ff3d3d', size: 14, symbol: 'diamond', line: { color: '#ff8080', width: 1.5 } },
        text: ['▲ WORST'],
        textposition: 'top center',
        textfont: { family: MONO, size: 9, color: '#ff3d3d' },
        hovertemplate:
          `<b>WORST CASE</b><br>` +
          `LAT: %{y}°N<br>LON: %{x}°E<br>` +
          `MEAN: ${worst.mean_weeks.toFixed(1)} wks<extra></extra>`,
        showlegend: false,
      }
    : null

  const traces: Plotly.Data[] = [
    {
      type: 'heatmap',
      x: data.lon_grid,
      y: data.lat_grid,
      z,
      colorscale: WEEKS_COLORSCALE,
      zmin,
      zmax,
      colorbar: {
        title: { text: 'MEAN WKS', font: AXIS.titleFont },
        tickfont: AXIS.tickfont,
        thickness: 10,
        len: 0.9,
      },
      hovertemplate:
        `<b>${label} / ${mode}</b><br>` +
        `LAT: %{y}°N<br>LON: %{x}°E<br>` +
        `MEAN: %{z:.1f} wks<extra></extra>`,
    },
  ]
  if (worstMarker) traces.push(worstMarker)

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
          ticks: '',
        },
        yaxis: {
          title: { text: 'LATITUDE', font: AXIS.titleFont },
          color: AXIS.color,
          gridcolor: AXIS.gridcolor,
          tickfont: AXIS.tickfont,
          ticks: '',
        },
        height: 360,
        margin: { l: 58, r: 60, t: 10, b: 52 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
