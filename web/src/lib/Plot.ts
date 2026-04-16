// react-plotly.js ships CJS and its default export is not a React component in
// Vite's ESM world. The factory pattern avoids the interop issue.
import Plotly from 'plotly.js-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'

export default createPlotlyComponent(Plotly)
