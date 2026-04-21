import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import Map, { Source, Layer, Popup } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapRef, MapMouseEvent, MapGeoJSONFeature } from 'react-map-gl/maplibre'
import type { FeatureCollection, Feature, LineString, Point } from 'geojson'
import { useSimulationStore } from '../../store/simulationStore'
import { useSimulation } from '../../hooks/useSimulation'
import { useGainMap } from '../../hooks/useGainMap'
import { weekColor } from './mapUtils'
import type { MeasurementModel } from '../../types/api'
import type { DecodedGrid, DecodedParticles, GridCell } from './mapUtils'
import { ConvergenceChart } from '../simulation/ConvergenceChart'
import { BeliefSurface3D } from './BeliefSurface3D'
import styles from './SimulationMap.module.css'

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json'

const INITIAL_VIEW = { longitude: -96, latitude: 37.5, zoom: 4 }

const CONUS_BOUNDS: [[number, number], [number, number]] = [[-128, 22], [-64, 52]]

const EARTH_RADIUS_MI = 3958.8

function makeCircleCoords(lon: number, lat: number, radiusMiles: number, steps = 96): [number, number][] {
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

function makeEllipseCoords(
  centerLat: number, centerLon: number,
  semiMajorMi: number, semiMinorMi: number, angleDeg: number,
  steps = 72,
): [number, number][] {
  const theta = (angleDeg * Math.PI) / 180
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const lat0 = (centerLat * Math.PI) / 180
  const lon0 = (centerLon * Math.PI) / 180
  const coords: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI
    const u = semiMajorMi * Math.cos(t)
    const v = semiMinorMi * Math.sin(t)
    const xEast  = u * cosT - v * sinT
    const yNorth = u * sinT + v * cosT
    const dist = Math.sqrt(xEast * xEast + yNorth * yNorth)
    if (dist < 1e-6) {
      coords.push([centerLon, centerLat])
      continue
    }
    const bearing = Math.atan2(xEast, yNorth)
    const ang = dist / EARTH_RADIUS_MI
    const lat1 = Math.asin(
      Math.sin(lat0) * Math.cos(ang) + Math.cos(lat0) * Math.sin(ang) * Math.cos(bearing),
    )
    const lon1 =
      lon0 + Math.atan2(
        Math.sin(bearing) * Math.sin(ang) * Math.cos(lat0),
        Math.cos(ang) - Math.sin(lat0) * Math.sin(lat1),
      )
    coords.push([(lon1 * 180) / Math.PI, (lat1 * 180) / Math.PI])
  }
  return coords
}

function toRgb(r: number, g: number, b: number) { return `rgb(${r},${g},${b})` }

// Interactive layers (hover / click detection)
const INTERACTIVE = [
  'ring-lines',
  'observer-outer', 'observer-core',
  'estimate-outer',
  'box-outer', 'box-preview-outer',
]

interface HoverInfo {
  lng: number
  lat: number
  props: Record<string, unknown>
}

export function SimulationMap() {
  const {
    currentStep, decodedGrid, decodedParticles,
    boxLocation, previewBoxLocation,
    boxPlacementMode, status, strategy,
    setPreviewBoxLocation,
    gainMapEnabled, gainMapPoints, gainMapStale, setGainMapEnabled,
    view3D, setView3D,
    ellipseEnabled, setEllipseEnabled,
  } = useSimulationStore()
  const { step } = useSimulation()
  useGainMap()

  const [hover, setHover] = useState<HoverInfo | null>(null)
  const [mouseCoords, setMouseCoords] = useState<{ lng: number; lat: number } | null>(null)
  const mapRef = useRef<MapRef>(null)
  const prevStatusRef = useRef(status)

  const measurements: MeasurementModel[] = currentStep?.measurements ?? []
  const best = currentStep?.best_estimate ?? null

  const activeBox = boxLocation ?? previewBoxLocation

  useEffect(() => {
    const prevStatus = prevStatusRef.current
    prevStatusRef.current = status

    if (prevStatus === 'idle' && status === 'running') {
      const map = mapRef.current
      if (!map) return
      const box = previewBoxLocation

      map.flyTo({ center: [-96, 20], zoom: 1.8, duration: 1000, essential: true })

      setTimeout(() => {
        if (box) {
          map.flyTo({ center: [box.lon, box.lat], zoom: 8, duration: 2000, essential: true })
        }
      }, 1300)

      setTimeout(() => {
        mapRef.current?.fitBounds(CONUS_BOUNDS, { padding: 50, duration: 1500, essential: true })
      }, 4000)
    }
  }, [status, previewBoxLocation])

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
      const { lats, lons } = decodedParticles as DecodedParticles
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

  const gainGeoJSON = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: (gainMapPoints ?? []).map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] } as Point,
      properties: { g: p.gain },
    })),
  }), [gainMapPoints])

  const ANIM_MS = 600
  const lastIdx = measurements.length - 1
  const lastMeasurement = lastIdx >= 0 ? measurements[lastIdx] : null
  const [animProgress, setAnimProgress] = useState(1)
  const animKeyRef = useRef<string>('')

  useEffect(() => {
    if (!lastMeasurement) return
    const key = `${lastIdx}|${lastMeasurement.location.lat.toFixed(4)}|${lastMeasurement.location.lon.toFixed(4)}`
    if (animKeyRef.current === key) return
    animKeyRef.current = key
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ANIM_MS)
      setAnimProgress(t)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    setAnimProgress(0)
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [lastIdx, lastMeasurement])

  // Cubic ease-out
  const ease = (t: number) => 1 - (1 - t) ** 3

  const ringsGeoJSON = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: measurements.flatMap((m, i) => {
      const [r, g, b] = weekColor(i)
      const color = toRgb(r, g, b)
      const isLatest = i === lastIdx
      const radius = isLatest ? m.distance * ease(animProgress) : m.distance
      const ringOpacity = isLatest ? 0.45 + 0.55 * animProgress : 0.55
      const obsPulse = isLatest ? 1 + (1 - animProgress) * 1.4 : 1
      return [
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: makeCircleCoords(m.location.lon, m.location.lat, Math.max(radius, 0.01)),
          } as LineString,
          properties: {
            color,
            kind:     'ring',
            week:     i + 1,
            lat:      m.location.lat,
            lon:      m.location.lon,
            distance: m.distance,
            opacity:  ringOpacity,
          },
        } as Feature,
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [m.location.lon, m.location.lat] } as Point,
          properties: {
            color,
            kind:     'observer',
            week:     i + 1,
            label:    `W${i + 1}`,
            lat:      m.location.lat,
            lon:      m.location.lon,
            distance: m.distance,
            pulse:    obsPulse,
          },
        } as Feature,
      ]
    }),
  }), [measurements, lastIdx, animProgress])

  const markerGeoJSON = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: [
      ...(best ? [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [best.lon, best.lat] } as Point,
        properties: { kind: 'estimate', lat: best.lat, lon: best.lon },
      } as Feature] : []),
      ...(boxLocation ? [{
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [boxLocation.lon, boxLocation.lat] } as Point,
        properties: { kind: 'box', lat: boxLocation.lat, lon: boxLocation.lon },
      } as Feature] : []),
    ],
  }), [best, boxLocation])

  const ellipseGeoJSON = useMemo((): FeatureCollection => {
    const e = currentStep?.ellipse
    if (!ellipseEnabled || !e || e.semi_major_mi <= 0) {
      return { type: 'FeatureCollection', features: [] }
    }
    const ring = makeEllipseCoords(
      e.center_lat, e.center_lon,
      e.semi_major_mi, e.semi_minor_mi, e.angle_deg,
    )
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [ring] },
        properties: { kind: 'ellipse' },
      } as Feature],
    }
  }, [currentStep, ellipseEnabled])

  const previewGeoJSON = useMemo((): FeatureCollection => ({
    type: 'FeatureCollection',
    features: !boxLocation && previewBoxLocation ? [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [previewBoxLocation.lon, previewBoxLocation.lat] } as Point,
      properties: { kind: 'preview', lat: previewBoxLocation.lat, lon: previewBoxLocation.lon },
    } as Feature] : [],
  }), [previewBoxLocation, boxLocation])

  const isPickMode = boxPlacementMode === 'manual' && status === 'idle'
  const isManualMeasureMode = strategy === 'manual' && status === 'running'
  const [hoveredFeature, setHoveredFeature] = useState(false)
  const cursor = (isPickMode || isManualMeasureMode)
    ? 'crosshair'
    : (hoveredFeature ? 'crosshair' : 'grab')

  const onMouseMove = useCallback((e: MapMouseEvent) => {
    setMouseCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat })
    const feature = (e.features as MapGeoJSONFeature[] | undefined)?.[0]
    if (feature && !isPickMode) {
      setHoveredFeature(true)
      const coords = (feature.geometry as { coordinates: number[] | number[][] }).coordinates
      const [lng, lat] =
        feature.geometry.type === 'Point'
          ? (coords as number[])
          : (coords as number[][])[Math.floor((coords as number[][]).length / 2)]
      if (isNaN(lng) || isNaN(lat)) return
      setHover({
        lng,
        lat,
        props: feature.properties as Record<string, unknown>,
      })
    } else {
      setHoveredFeature(false)
      setHover(null)
    }
  }, [isPickMode])

  const onMouseLeave = useCallback(() => {
    setHoveredFeature(false)
    setHover(null)
    setMouseCoords(null)
  }, [])

  const onMapClick = useCallback((e: MapMouseEvent) => {
    const { boxPlacementMode: mode, status: s, strategy: strat } = useSimulationStore.getState()
    if (mode === 'manual' && s === 'idle') {
      setPreviewBoxLocation({ lat: e.lngLat.lat, lon: e.lngLat.lng })
      return
    }
    if (strat === 'manual' && s === 'running') {
      step({ lat: e.lngLat.lat, lon: e.lngLat.lng })
    }
  }, [setPreviewBoxLocation, step])

  return (
    <div className={styles.wrap}>
      <Map
        ref={mapRef}
        initialViewState={INITIAL_VIEW}
        minZoom={2}
        maxZoom={10}
        mapStyle={MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        interactiveLayerIds={INTERACTIVE}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onClick={onMapClick}
        cursor={cursor}
      >
        {/* Belief heatmap */}
        <Source id="belief" type="geojson" data={beliefGeoJSON}>
          <Layer
            id="belief-heat"
            type="heatmap"
            paint={{
              'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 1],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 2],
              'heatmap-color': [
                'interpolate', ['linear'], ['heatmap-density'],
                0,   'rgba(0,0,0,0)',
                0.1, 'rgba(255,165,0,0.2)',
                0.4, 'rgba(255,100,0,0.55)',
                0.7, 'rgba(220,30,0,0.8)',
                1,   'rgba(180,0,0,1)',
              ],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 8, 28],
              'heatmap-opacity': 0.85,
            }}
          />
        </Source>

        {/* F-A — info-gain overlay (on top of belief so it's visible) */}
        {gainMapEnabled && (
          <Source id="gain" type="geojson" data={gainGeoJSON}>
            <Layer
              id="gain-heat"
              type="heatmap"
              paint={{
                'heatmap-weight':    ['interpolate', ['linear'], ['get', 'g'], 0, 0, 1, 1],
                'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 8, 2.5],
                'heatmap-color': [
                  'interpolate', ['linear'], ['heatmap-density'],
                  0,    'rgba(0,0,0,0)',
                  0.15, 'rgba(0,80,160,0.3)',
                  0.4,  'rgba(0,200,180,0.55)',
                  0.7,  'rgba(120,255,100,0.75)',
                  1,    'rgba(255,255,80,0.9)',
                ],
                'heatmap-radius':  ['interpolate', ['linear'], ['zoom'], 3, 22, 8, 70],
                'heatmap-opacity': gainMapStale ? 0.2 : 0.65,
              }}
            />
          </Source>
        )}

        {/* Rings (dashed) + observer reticles */}
        <Source id="rings" type="geojson" data={ringsGeoJSON}>
          {/* Dashed range rings */}
          <Layer
            id="ring-lines"
            type="line"
            filter={['==', ['geometry-type'], 'LineString']}
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 1,
              'line-opacity': ['coalesce', ['get', 'opacity'], 0.55],
              'line-dasharray': [5, 4],
            }}
          />
          {/* Observer: outer ring (radius modulated by `pulse` for animation) */}
          <Layer
            id="observer-outer"
            type="circle"
            filter={['==', ['geometry-type'], 'Point']}
            paint={{
              'circle-radius': ['*', 9, ['coalesce', ['get', 'pulse'], 1]],
              'circle-color': 'transparent',
              'circle-stroke-color': ['get', 'color'],
              'circle-stroke-width': 1.5,
              'circle-stroke-opacity': 0.9,
            }}
          />
          {/* Observer: inner dot */}
          <Layer
            id="observer-core"
            type="circle"
            filter={['==', ['geometry-type'], 'Point']}
            paint={{
              'circle-radius': 2.5,
              'circle-color': ['get', 'color'],
              'circle-opacity': 0.95,
            }}
          />
          {/* Observer: week label */}
          <Layer
            id="observer-labels"
            type="symbol"
            filter={['==', ['geometry-type'], 'Point']}
            layout={{
              'text-field': ['get', 'label'],
              'text-size': 8,
              'text-offset': [0, -1.8],
              'text-font': ['literal', ['Open Sans Bold', 'Arial Unicode MS Bold']],
              'text-anchor': 'bottom',
            }}
            paint={{
              'text-color': ['get', 'color'],
              'text-halo-color': 'rgba(0,0,0,0.85)',
              'text-halo-width': 1.5,
            }}
          />
        </Source>

        {/* Best estimate + confirmed box */}
        <Source id="markers" type="geojson" data={markerGeoJSON}>
          {/* Estimate: outer ring */}
          <Layer
            id="estimate-outer"
            type="circle"
            filter={['==', ['get', 'kind'], 'estimate']}
            paint={{
              'circle-radius': 13,
              'circle-color': 'transparent',
              'circle-stroke-color': '#ff3d3d',
              'circle-stroke-width': 1,
              'circle-stroke-opacity': 0.6,
            }}
          />
          {/* Estimate: mid ring */}
          <Layer
            id="estimate-mid"
            type="circle"
            filter={['==', ['get', 'kind'], 'estimate']}
            paint={{
              'circle-radius': 8,
              'circle-color': 'transparent',
              'circle-stroke-color': '#ff3d3d',
              'circle-stroke-width': 1.5,
              'circle-stroke-opacity': 0.85,
            }}
          />
          {/* Estimate: core */}
          <Layer
            id="estimate-core"
            type="circle"
            filter={['==', ['get', 'kind'], 'estimate']}
            paint={{
              'circle-radius': 3,
              'circle-color': '#ff3d3d',
            }}
          />
          {/* Confirmed box: outer ring */}
          <Layer
            id="box-outer"
            type="circle"
            filter={['==', ['get', 'kind'], 'box']}
            paint={{
              'circle-radius': 18,
              'circle-color': 'transparent',
              'circle-stroke-color': '#00e676',
              'circle-stroke-width': 1,
              'circle-stroke-opacity': 0.5,
            }}
          />
          {/* Confirmed box: mid ring */}
          <Layer
            id="box-mid"
            type="circle"
            filter={['==', ['get', 'kind'], 'box']}
            paint={{
              'circle-radius': 11,
              'circle-color': 'transparent',
              'circle-stroke-color': '#00e676',
              'circle-stroke-width': 2,
              'circle-stroke-opacity': 0.9,
            }}
          />
          {/* Confirmed box: core */}
          <Layer
            id="box-core"
            type="circle"
            filter={['==', ['get', 'kind'], 'box']}
            paint={{
              'circle-radius': 4,
              'circle-color': '#00e676',
            }}
          />
        </Source>

        {/* F-N — 95% covariance ellipse */}
        <Source id="ellipse" type="geojson" data={ellipseGeoJSON}>
          <Layer
            id="ellipse-fill"
            type="fill"
            paint={{
              'fill-color': '#e040fb',
              'fill-opacity': 0.12,
            }}
          />
          <Layer
            id="ellipse-halo"
            type="line"
            paint={{
              'line-color': '#e040fb',
              'line-width': 6,
              'line-opacity': 0.22,
              'line-blur': 3,
            }}
          />
          <Layer
            id="ellipse-outline"
            type="line"
            paint={{
              'line-color': '#e040fb',
              'line-width': 2.5,
              'line-opacity': 0.95,
            }}
          />
        </Source>

        {/* Preview box (before trial complete) */}
        <Source id="preview" type="geojson" data={previewGeoJSON}>
          <Layer
            id="box-preview-outer"
            type="circle"
            paint={{
              'circle-radius': 18,
              'circle-color': 'transparent',
              'circle-stroke-color': '#00e676',
              'circle-stroke-width': 1,
              'circle-stroke-opacity': 0.3,
            }}
          />
          <Layer
            id="box-preview-mid"
            type="circle"
            paint={{
              'circle-radius': 11,
              'circle-color': 'transparent',
              'circle-stroke-color': '#00e676',
              'circle-stroke-width': 1.5,
              'circle-stroke-opacity': 0.5,
            }}
          />
          <Layer
            id="box-preview-core"
            type="circle"
            paint={{
              'circle-radius': 3.5,
              'circle-color': '#00e676',
              'circle-opacity': 0.6,
            }}
          />
          <Layer
            id="box-preview-label"
            type="symbol"
            layout={{
              'text-field': 'TARGET',
              'text-size': 8,
              'text-offset': [0, 2.2],
              'text-font': ['literal', ['Open Sans Bold', 'Arial Unicode MS Bold']],
              'text-anchor': 'top',
            }}
            paint={{
              'text-color': 'rgba(0,230,118,0.65)',
              'text-halo-color': 'rgba(0,0,0,0.9)',
              'text-halo-width': 1.5,
            }}
          />
        </Source>

        {/* Hover popup */}
        {hover && (
          <Popup
            longitude={hover.lng}
            latitude={hover.lat}
            closeButton={false}
            closeOnClick={false}
            className={styles.popup}
            offset={14}
          >
            <HoverCard props={hover.props} />
          </Popup>
        )}
      </Map>

      {/* Pick-mode overlay instruction */}
      {isPickMode && !activeBox && (
        <div className={styles.pickOverlay}>
          <span className={styles.pickGlyph}>[+]</span>
          <span>CLICK TO PLACE TARGET</span>
        </div>
      )}

      {/* Manual-measurement HUD */}
      {isManualMeasureMode && (
        <div className={styles.manualHud}>
          <span className={styles.manualHudGlyph}>[+]</span>
          <span className={styles.manualHudText}>
            CLICK MAP TO MEASURE · WEEK {(currentStep?.week ?? 0) + 1}
          </span>
        </div>
      )}

      {/* Scanline overlay */}
      <div className={styles.scanlines} />

      {/* Corner decorations */}
      <div className={`${styles.corner} ${styles.cornerTL}`} />
      <div className={`${styles.corner} ${styles.cornerTR}`} />
      <div className={`${styles.corner} ${styles.cornerBL}`} />
      <div className={`${styles.corner} ${styles.cornerBR}`} />

      {/* Coordinate readout */}
      <div className={styles.readout}>
        <span className={styles.readoutLabel}>CONUS</span>
        <span className={styles.readoutSep}>·</span>
        {mouseCoords ? (
          <>
            <span>LAT {mouseCoords.lat >= 0 ? mouseCoords.lat.toFixed(4) + '°N' : Math.abs(mouseCoords.lat).toFixed(4) + '°S'}</span>
            <span className={styles.readoutSep}>·</span>
            <span>LON {mouseCoords.lng >= 0 ? mouseCoords.lng.toFixed(4) + '°E' : Math.abs(mouseCoords.lng).toFixed(4) + '°W'}</span>
          </>
        ) : (
          <>
            <span>LAT 24–50°N</span>
            <span className={styles.readoutSep}>·</span>
            <span>LON 66–125°W</span>
          </>
        )}
      </div>

      {/* Map legend */}
      <MapLegend />

      {/* F-A / F-H overlay toggles */}
      <div className={styles.overlayToggles}>
        <button
          className={`${styles.overlayToggle} ${gainMapEnabled ? styles.overlayToggleOn : ''}`}
          onClick={() => setGainMapEnabled(!gainMapEnabled)}
          title="Show predicted information gain per candidate measurement location"
        >
          {gainMapEnabled ? '◉' : '○'} GAIN MAP
        </button>
        <button
          className={`${styles.overlayToggle} ${view3D ? styles.overlayToggleOn : ''}`}
          onClick={() => setView3D(!view3D)}
          title="Toggle 3D belief surface"
        >
          {view3D ? '◉' : '○'} 3D
        </button>
        <button
          className={`${styles.overlayToggle} ${ellipseEnabled ? styles.overlayToggleOn : ''}`}
          onClick={() => setEllipseEnabled(!ellipseEnabled)}
          title="Show 95% covariance ellipse of the current belief"
        >
          {ellipseEnabled ? '◉' : '○'} ELLIPSE
        </button>
      </div>

      {/* F-H — 3D belief surface (overlays the map when active) */}
      {view3D && <BeliefSurface3D />}

      {/* Convergence HUD */}
      <ConvergencePanel />
    </div>
  )
}

function ConvergencePanel() {
  const { history, status } = useSimulationStore()
  const [collapsed, setCollapsed] = useState(false)

  if (history.length === 0) return null

  const localized = status === 'complete' && history.at(-1)?.localized

  return (
    <div className={styles.convergencePanel}>
      <div className={styles.convergencePanelHead}>
        <span className={`${styles.convergencePanelTitle} ${localized ? styles.convergenceTitleGreen : ''}`}>
          CONVERGENCE
        </span>
        <button
          className={styles.convergencePanelToggle}
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▶ EXPAND' : '▼ COLLAPSE'}
        </button>
      </div>
      {!collapsed && (
        <div className={styles.convergencePanelBody}>
          <ConvergenceChart
            height={260}
            margin={{ l: 50, r: 14, t: 8, b: 40 }}
          />
        </div>
      )}
    </div>
  )
}

function MapLegend() {
  const gainMapEnabled = useSimulationStore((s) => s.gainMapEnabled)
  const ellipseEnabled = useSimulationStore((s) => s.ellipseEnabled)
  return (
    <div className={styles.legend}>
      <div className={styles.legendTitle}>LAYER KEY</div>
      <div className={styles.legendItem}>
        <span className={styles.legendDotBelief} />
        <span>BELIEF HEAT</span>
      </div>
      {gainMapEnabled && (
        <div className={styles.legendItem}>
          <span className={styles.legendDotGain} />
          <span>INFO GAIN</span>
        </div>
      )}
      {ellipseEnabled && (
        <div className={styles.legendItem}>
          <span
            className={styles.legendLine}
            style={{
              borderTop: '2.5px solid #e040fb',
              background: 'rgba(224,64,251,0.12)',
              boxShadow: '0 0 6px rgba(224,64,251,0.5)',
            }}
          />
          <span>95% ELLIPSE</span>
        </div>
      )}
      <div className={styles.legendItem}>
        <span className={styles.legendLine} />
        <span>DIST RING</span>
      </div>
      <div className={styles.legendItem}>
        <span className={styles.legendReticle} />
        <span>OBSERVER</span>
      </div>
      <div className={styles.legendItem}>
        <span className={styles.legendDotEstimate} />
        <span>ESTIMATE</span>
      </div>
      <div className={styles.legendItem}>
        <span className={styles.legendDotBox} />
        <span>TARGET</span>
      </div>
    </div>
  )
}

function HoverCard({ props }: { props: Record<string, unknown> }) {
  const kind = props.kind as string

  if (kind === 'ring' || kind === 'observer') {
    return (
      <div className={styles.card}>
        <div className={styles.cardHead}>
          OBSERVER · W{props.week as number}
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardKey}>LAT</span>
          <span className={styles.cardVal}>{(props.lat as number).toFixed(4)}°N</span>
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardKey}>LON</span>
          <span className={styles.cardVal}>{Math.abs(props.lon as number).toFixed(4)}°W</span>
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardKey}>DIST</span>
          <span className={styles.cardVal}>{(props.distance as number).toFixed(1)} mi</span>
        </div>
      </div>
    )
  }

  if (kind === 'estimate') {
    return (
      <div className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadRed}`}>BEST ESTIMATE</div>
        <div className={styles.cardRow}>
          <span className={styles.cardKey}>LAT</span>
          <span className={styles.cardVal}>{(props.lat as number).toFixed(4)}°N</span>
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardKey}>LON</span>
          <span className={styles.cardVal}>{Math.abs(props.lon as number).toFixed(4)}°W</span>
        </div>
      </div>
    )
  }

  if (kind === 'box' || kind === 'preview') {
    return (
      <div className={styles.card}>
        <div className={`${styles.cardHead} ${styles.cardHeadGreen}`}>
          {kind === 'box' ? 'TARGET LOCATION' : 'TARGET (PREVIEW)'}
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardKey}>LAT</span>
          <span className={styles.cardVal}>{(props.lat as number).toFixed(4)}°N</span>
        </div>
        <div className={styles.cardRow}>
          <span className={styles.cardKey}>LON</span>
          <span className={styles.cardVal}>{Math.abs(props.lon as number).toFixed(4)}°W</span>
        </div>
      </div>
    )
  }

  return null
}
