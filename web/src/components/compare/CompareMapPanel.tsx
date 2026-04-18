import { useMemo } from 'react'
import Map, { Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection, Feature, LineString, Point } from 'geojson'
import type { CompareSlice } from '../../store/compareStore'
import type { MeasurementModel } from '../../types/api'
import type { GridCell } from '../map/mapUtils'
import { weekColor } from '../map/mapUtils'
import styles from './CompareMapPanel.module.css'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'
const INITIAL_VIEW = { longitude: -96, latitude: 37.5, zoom: 3.4 }
const EARTH_RADIUS_MI = 3958.8

function makeCircleCoords(lon: number, lat: number, radiusMiles: number, steps = 72): [number, number][] {
  const d    = radiusMiles / EARTH_RADIUS_MI
  const lat0 = (lat * Math.PI) / 180
  const lon0 = (lon * Math.PI) / 180
  const coords: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const bearing = (i / steps) * 2 * Math.PI
    const lat1 = Math.asin(
      Math.sin(lat0) * Math.cos(d) + Math.cos(lat0) * Math.sin(d) * Math.cos(bearing),
    )
    const lon1 =
      lon0 + Math.atan2(
        Math.sin(bearing) * Math.sin(d) * Math.cos(lat0),
        Math.cos(d) - Math.sin(lat0) * Math.sin(lat1),
      )
    coords.push([(lon1 * 180) / Math.PI, (lat1 * 180) / Math.PI])
  }
  return coords
}

function toRgb(r: number, g: number, b: number) { return `rgb(${r},${g},${b})` }

interface Props {
  slice: CompareSlice
  label: string
  accentColor: string
}

export function CompareMapPanel({ slice, label, accentColor }: Props) {
  const { currentStep, decodedGrid, decodedParticles, boxLocation } = slice
  const measurements: MeasurementModel[] = currentStep?.measurements ?? []
  const best = currentStep?.best_estimate ?? null

  const beliefGeoJSON = useMemo((): FeatureCollection => {
    if (decodedGrid) {
      const { cells, maxWeight } = decodedGrid
      return {
        type: 'FeatureCollection',
        features: cells.map((cell: GridCell) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: cell.position } as Point,
          properties: { w: maxWeight > 0 ? cell.weight / maxWeight : 0 },
        })),
      }
    }
    if (decodedParticles) {
      const { lats, lons } = decodedParticles
      return {
        type: 'FeatureCollection',
        features: Array.from({ length: lats.length }, (_, i): Feature => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lons[i], lats[i]] } as Point,
          properties: { w: 0.5 },
        })),
      }
    }
    return { type: 'FeatureCollection', features: [] }
  }, [decodedGrid, decodedParticles])

  const ringsGeoJSON = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: measurements.flatMap((m, i) => {
      const [r, g, b] = weekColor(i)
      const color = toRgb(r, g, b)
      return [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: makeCircleCoords(m.location.lon, m.location.lat, m.distance),
          } as LineString,
          properties: { color },
        } as Feature,
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [m.location.lon, m.location.lat] } as Point,
          properties: { color },
        } as Feature,
      ]
    }),
  }), [measurements])

  const markerGeoJSON = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: [
      ...(best ? [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [best.lon, best.lat] } as Point,
        properties: { kind: 'estimate' },
      } as Feature] : []),
      ...(boxLocation ? [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [boxLocation.lon, boxLocation.lat] } as Point,
        properties: { kind: 'box' },
      } as Feature] : []),
    ],
  }), [best, boxLocation])

  const week  = currentStep?.week ?? 0
  const radius = currentStep?.uncertainty_radius
  const isLocalized = slice.status === 'complete' && currentStep?.localized

  return (
    <div className={styles.panel}>
      <div className={styles.header} style={{ borderColor: accentColor }}>
        <span className={styles.label} style={{ color: accentColor }}>{label}</span>
        <span className={styles.strategy}>{slice.strategy.replace('_', '-').toUpperCase()}</span>
        <span className={styles.mode}>{slice.measurementMode}</span>
        {week > 0 && (
          <span className={styles.week}>W{String(week).padStart(2, '0')}</span>
        )}
        {radius !== undefined && radius < 9999 && (
          <span className={`${styles.radius} ${isLocalized ? styles.radiusGreen : ''}`}>
            {radius.toFixed(1)} mi
          </span>
        )}
      </div>

      <div className={styles.mapWrap}>
        <Map
          initialViewState={INITIAL_VIEW}
          minZoom={2}
          maxZoom={10}
          mapStyle={MAP_STYLE}
          style={{ width: '100%', height: '100%' }}
        >
          <Source id="belief" type="geojson" data={beliefGeoJSON}>
            <Layer
              id="belief-heat"
              type="heatmap"
              paint={{
                'heatmap-weight':     ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 1],
                'heatmap-intensity':  ['interpolate', ['linear'], ['zoom'], 3, 0.8, 7, 2],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0,   'rgba(0,0,0,0)',
                  0.1, 'rgba(255,165,0,0.2)',
                  0.4, 'rgba(255,100,0,0.55)',
                  0.7, 'rgba(220,30,0,0.8)',
                  1,   'rgba(180,0,0,1)',
                ],
                'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 3, 10, 7, 24],
                'heatmap-opacity': 0.85,
              }}
            />
          </Source>

          <Source id="rings" type="geojson" data={ringsGeoJSON}>
            <Layer
              id="ring-lines"
              type="line"
              filter={['==', ['geometry-type'], 'LineString']}
              paint={{
                'line-color':     ['get', 'color'],
                'line-width':     1,
                'line-opacity':   0.5,
                'line-dasharray': [5, 4],
              }}
            />
            <Layer
              id="observer-core"
              type="circle"
              filter={['==', ['geometry-type'], 'Point']}
              paint={{
                'circle-radius': 3,
                'circle-color':  ['get', 'color'],
              }}
            />
          </Source>

          <Source id="markers" type="geojson" data={markerGeoJSON}>
            <Layer
              id="estimate-core"
              type="circle"
              filter={['==', ['get', 'kind'], 'estimate']}
              paint={{ 'circle-radius': 5, 'circle-color': '#ff3d3d' }}
            />
            <Layer
              id="box-core"
              type="circle"
              filter={['==', ['get', 'kind'], 'box']}
              paint={{ 'circle-radius': 6, 'circle-color': '#00e676' }}
            />
          </Source>
        </Map>

        {slice.status === 'complete' && (
          <div className={`${styles.resultBanner} ${isLocalized ? styles.resultBannerGreen : styles.resultBannerRed}`}>
            {isLocalized
              ? `LOCALIZED  W${currentStep?.week}`
              : 'TIMEOUT  W52'}
          </div>
        )}
      </div>
    </div>
  )
}
