// deck.gl 8.x ships CJS without proper .d.ts exports map for bundler resolution.
// These declarations let TypeScript be satisfied; skipLibCheck handles the rest.
declare module '@deck.gl/react' {
  import type { ComponentType } from 'react'
  const DeckGL: ComponentType<Record<string, unknown>>
  export default DeckGL
}

declare module '@deck.gl/layers' {
  export class ScatterplotLayer {
    constructor(props: Record<string, unknown>)
  }
  export class GeoJsonLayer {
    constructor(props: Record<string, unknown>)
  }
}
