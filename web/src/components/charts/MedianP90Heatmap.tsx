import Plot from '../../lib/Plot'
import type { ResultRow } from '../../types/api'
import { STRATEGY_ORDER, MODE_ORDER, pivotOn } from '../../api/results'
import { DARK_LAYOUT, WEEKS_COLORSCALE, MONO, AXIS } from './chartTheme'

const STRATEGY_LABELS = ['FIXED', 'RANDOM', 'MAX-SEP', 'CENTROID', 'INFO-GAIN*', 'ENTROPY*']
const MODE_LABELS     = ['EXACT', 'RND ±10mi', 'RND ±25mi', 'RND ±100mi', 'GAUSS σ5', 'GAUSS σ25']

interface Props { rows: ResultRow[] }

export function MedianP90Heatmap({ rows }: Props) {
  const medianZ = pivotOn(rows, 'median', STRATEGY_ORDER, MODE_ORDER)
  const p90Z    = pivotOn(rows, 'p90',    STRATEGY_ORDER, MODE_ORDER)

  const makeText = (z: number[][]) =>
    z.map((row) => row.map((v) => `${v.toFixed(0)}w`)) as unknown as string[]

  const sharedCell = { xgap: 2, ygap: 2 }

  // Invisible tick line creates a gap between cells and labels without showing a mark
  const sharedAxis = {
    type: 'category' as const,
    ticks: 'outside' as const,
    ticklen: 4,
    tickcolor: 'transparent',
    color: AXIS.color,
    tickfont: { ...AXIS.tickfont, size: 10 },
    gridcolor: AXIS.gridcolor,
  }

  return (
    <Plot
      data={[
        {
          type: 'heatmap',
          z:             medianZ,
          x:             MODE_LABELS,
          y:             STRATEGY_LABELS,
          text:          makeText(medianZ),
          texttemplate:  '%{text}',
          textfont:      { size: 11, family: MONO, color: '#f0f0f0' },
          hovertemplate: '<b>%{y} / %{x}</b><br>MEDIAN: %{z:.0f}w<extra></extra>',
          colorscale:    WEEKS_COLORSCALE,
          zmin: 5, zmax: 52,
          ...sharedCell,
          showscale: false,
          xaxis: 'x',
          yaxis: 'y',
        } as Plotly.Data,
        {
          type: 'heatmap',
          z:             p90Z,
          x:             MODE_LABELS,
          y:             STRATEGY_LABELS,
          text:          makeText(p90Z),
          texttemplate:  '%{text}',
          textfont:      { size: 11, family: MONO, color: '#f0f0f0' },
          hovertemplate: '<b>%{y} / %{x}</b><br>P90: %{z:.0f}w<extra></extra>',
          colorscale:    WEEKS_COLORSCALE,
          zmin: 5, zmax: 52,
          ...sharedCell,
          colorbar: {
            title: { text: 'WEEKS', font: { family: MONO, size: 11, color: '#d8d8d8' } },
            tickfont: { family: MONO, size: 11, color: '#d8d8d8' },
            dtick: 10,
            thickness: 12,
            x: 1.02,
          },
          xaxis: 'x2',
          yaxis: 'y2',
        } as Plotly.Data,
      ]}
      layout={{
        ...DARK_LAYOUT,
        grid: { rows: 1, columns: 2, pattern: 'independent', xgap: 0.12 },
        annotations: [
          {
            text: 'MEDIAN',
            xref: 'paper', yref: 'paper', x: 0.2, y: 1.1,
            showarrow: false,
            font: { size: 12, family: MONO, color: '#d8d8d8' },
          },
          {
            text: 'P90',
            xref: 'paper', yref: 'paper', x: 0.74, y: 1.1,
            showarrow: false,
            font: { size: 12, family: MONO, color: '#d8d8d8' },
          },
        ],
        xaxis:  { ...sharedAxis, tickangle: 30 },
        yaxis:  { ...sharedAxis, autorange: 'reversed' as const },
        xaxis2: { ...sharedAxis, tickangle: 30 },
        yaxis2: { ...sharedAxis, autorange: 'reversed' as const, showticklabels: false, ticks: '' },
        height: 340,
        margin: { l: 90, r: 96, t: 52, b: 72 },
      }}
      style={{ width: '100%' }}
      useResizeHandler
      config={{ displayModeBar: false }}
    />
  )
}
