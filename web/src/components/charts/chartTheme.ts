// Shared Plotly layout defaults for dark theme

export const DARK_LAYOUT: Partial<Plotly.Layout> = {
  paper_bgcolor: '#111',
  plot_bgcolor: '#111',
  font: { family: 'Inter, system-ui, sans-serif', color: '#ccc' },
  margin: { l: 110, r: 110, t: 50, b: 70 },
}

export const FAILURE_COLORSCALE: [number, string][] = [
  [0.0, '#1a7f3c'],
  [0.2, '#7dbb6f'],
  [0.4, '#d4e88a'],
  [0.6, '#f4c04a'],
  [0.8, '#e8703a'],
  [1.0, '#c0392b'],
]

export const WEEKS_COLORSCALE: [number, string][] = [
  [0.0, '#1a7f3c'],
  [0.3, '#7dbb6f'],
  [0.6, '#f4c04a'],
  [1.0, '#c0392b'],
]

export const PLOTLY_COLORS = [
  '#636efa', '#ef553b', '#00cc96', '#ab63fa', '#ffa15a',
]
