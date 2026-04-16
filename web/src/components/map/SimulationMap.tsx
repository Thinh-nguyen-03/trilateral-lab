import { useState, useEffect, useMemo } from 'react'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers'
import { Map } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useSimulationStore } from '../../store/simulationStore'
import { weekColor } from './mapUtils'
import type { MeasurementModel, PointModel } from '../../types/api'
import type { DecodedGrid, DecodedParticles, GridCell } from './mapUtils'

const INITIAL_VIEW = {
  longitude: -96,
  latitude: 38,
  zoom: 3.5,
  pitch: 0,
  bearing: 0,
}

const MAP_STYLE =
  'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'

// Miles → meters
const MI_TO_M = 1609.34

function beliefLayers(
  decodedGrid: DecodedGrid | null,
  decodedParticles: DecodedParticles | null,
) {
  if (decodedGrid) {
    const { cells, maxWeight } = decodedGrid
    return [
      new ScatterplotLayer({
        id: 'belief-grid',
        data: cells,
        getPosition: (d: GridCell) => d.position,
        getRadius: 7500, // ~7.5 km, slightly larger than 0.1° cell
        radiusUnits: 'meters',
        getFillColor: (d: GridCell) => {
          const t = maxWeight > 0 ? d.weight / maxWeight : 0
          return [255, Math.round(165 - t * 100), 0, Math.round(t * 210 + 45)]
        },
        stroked: false,
        pickable: false,
        updateTriggers: { getFillColor: [maxWeight] },
      }),
    ]
  }

  if (decodedParticles) {
    const { lats, lons } = decodedParticles
    const data = Array.from({ length: lats.length }, (_, i) => i)
    return [
      new ScatterplotLayer({
        id: 'belief-particles',
        data,
        getPosition: (i: number) => [lons[i], lats[i]],
        getRadius: 12000,
        radiusUnits: 'meters',
        getFillColor: [30, 144, 255, 35],
        stroked: false,
        pickable: false,
      }),
    ]
  }

  return []
}

function measurementLayers(measurements: MeasurementModel[]) {
  return measurements.flatMap((m, i) => {
    const [r, g, b] = weekColor(i)
    return [
      // Distance ring
      new ScatterplotLayer({
        id: `ring-${i}`,
        data: [m],
        getPosition: () => [m.location.lon, m.location.lat],
        getRadius: () => m.distance * MI_TO_M,
        radiusUnits: 'meters',
        getFillColor: [0, 0, 0, 0],
        getLineColor: [r, g, b, 180],
        stroked: true,
        filled: false,
        lineWidthMinPixels: 1.5,
        pickable: false,
      }),
      // Observer dot
      new ScatterplotLayer({
        id: `dot-${i}`,
        data: [m],
        getPosition: () => [m.location.lon, m.location.lat],
        getRadius: 7,
        radiusUnits: 'pixels',
        getFillColor: [r, g, b, 240],
        stroked: false,
        pickable: false,
      }),
    ]
  })
}

function estimateLayer(best: PointModel | null) {
  if (!best) return []
  return [
    new ScatterplotLayer({
      id: 'best-estimate',
      data: [best],
      getPosition: (d: PointModel) => [d.lon, d.lat],
      getRadius: 9,
      radiusUnits: 'pixels',
      getFillColor: [255, 50, 50, 255],
      getLineColor: [255, 255, 255, 200],
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: false,
    }),
  ]
}

function boxLayer(box: PointModel | null) {
  if (!box) return []
  return [
    new ScatterplotLayer({
      id: 'box-location',
      data: [box],
      getPosition: (d: PointModel) => [d.lon, d.lat],
      getRadius: 11,
      radiusUnits: 'pixels',
      getFillColor: [0, 255, 128, 255],
      getLineColor: [255, 255, 255, 220],
      stroked: true,
      lineWidthMinPixels: 2,
      pickable: false,
    }),
  ]
}

export function SimulationMap() {
  const { currentStep, decodedGrid, decodedParticles, boxLocation } = useSimulationStore()
  const [viewState, setViewState] = useState(INITIAL_VIEW)

  // Boundary fetched once, cached in module scope
  const [boundary, setBoundary] = useState<object | null>(null)
  useEffect(() => {
    fetch('/api/us-boundary')
      .then((r) => r.json())
      .then(setBoundary)
      .catch(() => {})
  }, [])

  const layers = useMemo(() => {
    const measurements = currentStep?.measurements ?? []
    const best = currentStep?.best_estimate ?? null
    return [
      boundary &&
        new GeoJsonLayer({
          id: 'us-boundary',
          data: boundary,
          stroked: true,
          filled: false,
          getLineColor: [80, 80, 80, 200],
          lineWidthMinPixels: 1,
          pickable: false,
        }),
      ...beliefLayers(decodedGrid, decodedParticles),
      ...measurementLayers(measurements),
      ...estimateLayer(best),
      ...boxLayer(boxLocation),
    ].filter(Boolean)
  }, [boundary, decodedGrid, decodedParticles, currentStep, boxLocation])

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={({ viewState: vs }: { viewState: unknown }) => setViewState(vs as typeof INITIAL_VIEW)}
      controller
      layers={layers}
    >
      <Map mapStyle={MAP_STYLE} />
    </DeckGL>
  )
}
