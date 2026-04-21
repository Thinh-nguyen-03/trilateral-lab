// deck.gl 8.x ships TS types under /typed/ but doesn't declare a `types` field
// in package.json, so we shim minimal types for the surfaces we use.
declare module '@deck.gl/react' {
  import type { ComponentType, ReactNode } from 'react'
  export interface DeckGLProps {
    initialViewState?: unknown
    viewState?: unknown
    controller?: boolean | object
    layers?: unknown[]
    onViewStateChange?: (e: { viewState: unknown }) => void
    children?: ReactNode
    style?: React.CSSProperties
  }
  export const DeckGL: ComponentType<DeckGLProps>
  const _default: ComponentType<DeckGLProps>
  export default _default
}

declare module '@deck.gl/layers' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const ColumnLayer: any
}

declare module '@deck.gl/aggregation-layers' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const GridLayer: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const HexagonLayer: any
}

declare module '@deck.gl/core' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Deck: any
}
