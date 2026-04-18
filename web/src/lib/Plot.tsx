import { useEffect, useRef } from 'react'
import Plotly from 'plotly.js-dist-min'

interface Props {
  data: Plotly.Data[]
  layout?: Partial<Plotly.Layout>
  config?: Partial<Plotly.Config>
  style?: React.CSSProperties
  useResizeHandler?: boolean
}

export default function Plot({ data, layout, config, style, useResizeHandler }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    Plotly.react(ref.current, data, layout ?? {}, { displayModeBar: false, ...config })
  })

  useEffect(() => {
    if (!useResizeHandler || !ref.current) return
    const el = ref.current
    const observer = new ResizeObserver(() => {
      // Plotly.Plots.resize throws if the element is not visible in the DOM
      if (el.offsetParent !== null || el.closest('body')) {
        try { Plotly.Plots.resize(el) } catch { /* chart not yet mounted */ }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [useResizeHandler])

  return <div ref={ref} style={style} />
}
