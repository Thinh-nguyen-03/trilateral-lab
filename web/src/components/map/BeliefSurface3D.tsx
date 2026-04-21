import { useMemo } from 'react'
import { DeckGL } from '@deck.gl/react'
import { ColumnLayer } from '@deck.gl/layers'
import { Map } from 'react-map-gl/maplibre'
import { useSimulationStore } from '../../store/simulationStore'
import styles from './SimulationMap.module.css'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'

const INITIAL_VIEW = {
  longitude: -96,
  latitude:  35.0,
  zoom:      3.6,
  pitch:     50,
  bearing:   -10,
}

const COLUMN_RADIUS_METERS = 4500
const MAX_ELEVATION_METERS = 350_000

type ColumnDatum = { position: [number, number]; weight: number }

export function BeliefSurface3D() {
  const decodedGrid = useSimulationStore((s) => s.decodedGrid)
  const decodedParticles = useSimulationStore((s) => s.decodedParticles)
  const setView3D = useSimulationStore((s) => s.setView3D)

  const layer = useMemo(() => {
    if (decodedGrid && decodedGrid.maxWeight > 0) {
      const max = decodedGrid.maxWeight
      return new ColumnLayer({
        id: 'belief-3d',
        data: decodedGrid.cells,
        diskResolution: 6,
        radius: COLUMN_RADIUS_METERS,
        extruded: true,
        pickable: false,
        elevationScale: 1,
        getPosition: (d: ColumnDatum) => d.position,
        getElevation: (d: ColumnDatum) => (d.weight / max) * MAX_ELEVATION_METERS,
        getFillColor: (d: ColumnDatum) => {
          const t = Math.min(1, d.weight / max)
          const r = Math.round(60 + 195 * t)
          const g = Math.round(20 + 80 * (1 - t))
          const b = Math.round(10 + 5 * (1 - t))
          const a = Math.round(180 + 60 * t)
          return [r, g, b, a]
        },
        material: {
          ambient: 0.6,
          diffuse: 0.7,
          shininess: 32,
          specularColor: [255, 200, 100],
        },
        updateTriggers: {
          getElevation: max,
          getFillColor: max,
        },
      })
    }
    if (decodedParticles) {
      const { lats, lons, weights } = decodedParticles
      const maxW = Math.max(0, ...Array.from(weights))
      const data = Array.from({ length: lats.length }, (_, i) => ({
        position: [lons[i], lats[i]] as [number, number],
        weight: weights[i],
      }))
      return new ColumnLayer({
        id: 'belief-3d-particles',
        data,
        diskResolution: 6,
        radius: COLUMN_RADIUS_METERS,
        extruded: true,
        getPosition: (d: ColumnDatum) => d.position,
        getElevation: (d: ColumnDatum) => (d.weight / (maxW || 1)) * MAX_ELEVATION_METERS,
        getFillColor: () => [220, 100, 30, 200],
      })
    }
    return null
  }, [decodedGrid, decodedParticles])

  return (
    <div className={styles.surface3DRoot}>
      <DeckGL
        initialViewState={INITIAL_VIEW}
        controller
        layers={layer ? [layer] : []}
        style={{ width: '100%', height: '100%' }}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={false} />
      </DeckGL>

      <div className={styles.surface3DBadge}>
        <span>3D BELIEF SURFACE</span>
        <button
          className={styles.surface3DClose}
          onClick={() => setView3D(false)}
          title="Return to 2D view"
        >
          × CLOSE
        </button>
      </div>
      {!layer && (
        <div className={styles.surface3DEmpty}>NO BELIEF DATA — RUN A STEP TO SEE THE SURFACE</div>
      )}
    </div>
  )
}
