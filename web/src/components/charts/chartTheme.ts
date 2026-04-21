export const MONO = "'JetBrains Mono', 'Courier New', monospace"

export const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: '#050505',
  font: { family: MONO, color: '#d8d8d8', size: 12 },
  margin: { l: 90, r: 20, t: 28, b: 60 },
  hoverlabel: {
    bgcolor: '#111',
    bordercolor: '#444',
    font: { family: MONO, color: '#f0f0f0', size: 12 },
  },
}

/** Reusable axis style — explicitly sets all text colors so nothing inherits a dim parent. */
export const AXIS = {
  color: '#d8d8d8',
  gridcolor: '#181818',
  zerolinecolor: '#2a2a2a',
  tickfont: { family: MONO, size: 11, color: '#d8d8d8' },
  titleFont: { family: MONO, size: 11, color: '#d8d8d8' },
}

export const FAILURE_COLORSCALE: [number, string][] = [
  [0.0,  '#07280f'],
  [0.25, '#1a6e30'],
  [0.5,  '#c8901a'],
  [0.75, '#c0472b'],
  [1.0,  '#8b1a1a'],
]

export const WEEKS_COLORSCALE: [number, string][] = [
  [0.0,  '#07280f'],
  [0.35, '#1a6e30'],
  [0.65, '#c8901a'],
  [1.0,  '#8b1a1a'],
]

export const BLOOMBERG_COLORS = [
  '#ffab00',
  '#00bcd4',
  '#00e676',
  '#ff3d3d',
  '#b388ff',
  '#26c6da',
]
