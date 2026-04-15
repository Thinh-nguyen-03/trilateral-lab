# Web App Implementation Plan

Interactive frontend for the trilateration simulation — a dashboard of pre-computed results and a live simulation viewer with a US map.

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | FastAPI + uvicorn | Wraps existing Python sim code with minimal glue |
| Frontend framework | React 18 + Vite + TypeScript | Standard SPA tooling |
| Map | deck.gl 8.9 + react-map-gl + MapLibre | No API token, battle-tested 8.x API, HeatmapLayer + ScatterplotLayer |
| Charts | Plotly.js 2.x | Direct port of notebook `go.Figure` specs |
| State | Zustand 4.x | Minimal, no boilerplate |
| Data fetching | React Query 5.x | Caching, loading states |
| Gzip decode | pako 2.x | Sync, universally supported (vs DecompressionStream which breaks on Safari) |

---

## Repository Layout

```
trilateral-lab/
  src/                          existing — untouched
  data/                         existing — untouched
  api/                          NEW: FastAPI application
    main.py
    models.py                   Pydantic request/response types
    session_store.py            In-memory session dict + TTL cleanup
    serializers.py              Belief → gzip float32 → base64
    routes/
      results.py                GET /api/results
      session.py                POST/DELETE /api/session/*
      static_data.py            GET /api/us-boundary
  web/                          NEW: React + Vite application
    vite.config.ts              Proxies /api → :8000 in dev
    src/
      pages/
        DashboardPage.tsx       All 5 static charts
        SimulationPage.tsx      Live map + controls
      components/
        charts/                 FailureHeatmap, MeanWeeksHeatmap, FailureByModeLine,
                                StrategySpreadBar, MedianP90Heatmap, ChartContainer
        map/                    SimulationMap, BeliefHeatLayer, ParticleLayer,
                                MeasurementLayer, USBoundaryLayer, mapUtils.ts
        simulation/             SimulationPanel, StrategyModeForm, StepControls,
                                WeekTimeline, ConvergenceChart
        layout/                 AppShell, NavBar
      hooks/
        useResults.ts
        useSimulation.ts
        useBeliefDecoder.ts
      store/
        simulationStore.ts
      workers/
        beliefDecoder.worker.ts
      types/
        api.ts
```

---

## Phase 1 — FastAPI Backend

### Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/results` | GET | Serves `data/results.json`, cached in memory via `lru_cache` |
| `/api/us-boundary` | GET | Serves GeoJSON with 1-year `Cache-Control` header |
| `/api/session/start` | POST | Creates belief + strategy instance, returns session UUID + grid metadata |
| `/api/session/{id}/step` | POST | One week: choose location → measure → update belief → serialize response |
| `/api/session/{id}` | DELETE | Explicit cleanup on Reset |

### Session design

- Session state lives server-side — belief objects cannot round-trip through the client (9 MB uncompressed)
- In-memory dict keyed by UUID; entries expire after 30 min idle via a background asyncio cleanup task
- On the final step (`trial_complete: true`), session is auto-deleted and the true box location is revealed in the response

### Belief serialization

Belief weights are packed as **gzip-compressed float32 → base64** string in the JSON response.

| Mode | Payload size |
|---|---|
| Grid (EXACT / ROUND_*) | < 2 KB |
| Particle (Gaussian modes) | ~70 KB |

Both are acceptable for a step-on-click interaction model.

### Critical: thread pool for CPU-bound steps

InfoGain `choose_location()` takes ~300ms. Running it in an `async` route blocks the event loop. All strategy and belief calls must be wrapped in `run_in_executor(None, fn)`.

### Grid metadata

`StartSessionResponse` includes `grid_meta`:
```json
{ "lat_min": 24.5, "lat_max": 49.5, "lon_min": -124.7, "lon_max": -66.9,
  "step": 0.1, "n_lats": 250, "n_lons": 578 }
```
These constants are also hardcoded in `web/src/components/map/mapUtils.ts` — the frontend pre-generates the 144,500-cell position `Float32Array` once at module load and never re-uploads it.

---

## Phase 2 — Dashboard Page (Static Charts)

All five charts from `notebooks/analysis.ipynb` ported to React using `react-plotly.js`. The notebook's `go.Figure` specs translate almost verbatim to JS objects.

| Component | Source cell | Chart type |
|---|---|---|
| `FailureHeatmap` | Cell 3 | `go.Heatmap`, `failure_rate` z-axis |
| `MeanWeeksHeatmap` | Cell 5 | `go.Heatmap`, `mean` z-axis |
| `FailureByModeLine` | Cell 7 | `go.Scatter`, one trace per strategy, InfoGain dashed |
| `StrategySpreadBar` | Cell 9 | `go.Bar`, max − min failure rate per mode |
| `MedianP90Heatmap` | Cell 11 | Two side-by-side heatmaps |

Data flow: `GET /api/results` → 3 KB JSON → transform to 30-row flat array → all 5 charts. No further API calls needed on this page.

---

## Phase 3 — Map Visualization

### Layer stack (bottom to top)

1. MapLibre dark base map — CARTO dark-matter-nolabels (no token required)
2. `PolygonLayer` — US boundary outline
3. `HeatmapLayer` or `ScatterplotLayer` — belief grid (see note below)
4. `ScatterplotLayer` — particle cloud (Gaussian modes, semi-transparent)
5. `ScatterplotLayer` (stroked, unfilled) — distance rings per measurement
6. `ScatterplotLayer` — observer location dots
7. `ScatterplotLayer` — best estimate marker (red)

### Belief rendering mode

| Measurement mode | Layer | Reason |
|---|---|---|
| EXACT, ROUND_* | `ScatterplotLayer` (small squares per cell) | Preserves discrete arc structure; `HeatmapLayer` kernel-smooths it away |
| NOISY_GAUSSIAN_5/25 | `HeatmapLayer` | Belief is genuinely smooth, heatmap is appropriate |

### Performance — binary data format

The `positions` Float32Array (1.1 MB, `[lon, lat, lon, lat, ...]` for all 144,500 cells) is a **lazy singleton** — same reference every call. deck.gl sees the same reference and skips the GPU re-upload. Only the `weights` Float32Array changes per step (~0.56 MB GPU upload per step).

### Web Worker for decoding

Grid weights (< 2 KB gzipped): decoded on the main thread synchronously — Worker overhead not worth it.
Particle weights (~70 KB gzipped): decoded in a Web Worker using pako, transferred back as a `Transferable` (zero-copy).

---

## Phase 4 — Simulation Page

### Layout

```
┌─────────────────────┬───────────────────────────────────┐
│ Strategy dropdown   │                                   │
│ Mode dropdown       │         SimulationMap             │
│                     │         (deck.gl canvas)          │
│ [Start] [Step]      │                                   │
│ [▶ Auto] [Reset]    │                                   │
│                     │                                   │
│ Week 1  Week 2  ... │                                   │
│ (timeline scroll)   │                                   │
│                     │                                   │
│ Convergence chart   │                                   │
│ (uncertainty/week)  │                                   │
└─────────────────────┴───────────────────────────────────┘
```

### State machine

```
idle ──[Start]──► running ──[Step / auto-tick]──► running (loop)
                                               └──► complete (trial_complete from API)
any  ──[Reset]──► idle
```

### Auto-play

Default interval: 1500ms. InfoGain: 500ms (API adds ~300ms, total ~800ms feels natural).

### ConvergenceChart

Plotly line chart: `uncertainty_radius` (log scale) vs `week`. Horizontal dashed line at y=5 (localization threshold). Background turns green when localized.

### Box reveal

On `trial_complete: true`, the API includes the true `box_location` in the response. The map renders a distinct marker and the sidebar shows the true coordinates vs the best estimate.

---

## Phase 5 — Build & Deploy

### Dev workflow

```bash
# Terminal 1
uvicorn api.main:app --reload --port 8000

# Terminal 2
cd web && npm run dev   # Vite on :5173, proxies /api → :8000
```

### Production

React built to `web/dist/`. FastAPI serves it via `StaticFiles` mount — single origin, no CORS config needed.

### Docker

Single container: Python image, React assets baked in at build time, `uvicorn` as entrypoint.

---

## Key Risks

| Risk | Mitigation |
|---|---|
| InfoGain blocks async event loop | `run_in_executor(None, fn)` for all CPU-bound steps |
| HeatmapLayer re-uploads position array every step | Singleton `Float32Array` — deck.gl skips re-upload when reference is stable |
| Discrete arc structure lost in HeatmapLayer | Use `ScatterplotLayer` for EXACT/ROUND modes |
| Plotly.js bundle size (~1.4 MB gzipped) | Acceptable; use `plotly.js-dist-min` if it becomes an issue |
| Session lost on server restart | Acceptable for demo; add `.npz` disk serialization later if needed |
| US boundary too coarse for map display | Keep 233-pt version for Python rejection sampling; fetch higher-res GeoJSON for the map layer |
