# Progress Tracker

Status of all web app implementation work. Update checkboxes as tasks complete.

---

## Phase 1 — FastAPI Backend

### Setup
- [ ] Add `fastapi`, `uvicorn[standard]`, `pydantic>=2.7` to `requirements.txt`
- [ ] Create `api/` directory structure with `__init__.py` files

### Core modules
- [ ] `api/models.py` — Pydantic types: `StartSessionRequest`, `StartSessionResponse`, `StepResponse`, `GridBeliefModel`, `ParticleBeliefModel`, `PointModel`, `MeasurementModel`
- [ ] `api/session_store.py` — in-memory session dict, TTL expiry, background cleanup loop
- [ ] `api/serializers.py` — `serialize_belief()`: belief → gzip float32 → base64 string
- [ ] `api/main.py` — FastAPI app, CORS middleware, lifespan, route registration, StaticFiles mount

### Routes
- [ ] `api/routes/results.py` — `GET /api/results`: load `data/results.json` with `lru_cache`
- [ ] `api/routes/static_data.py` — `GET /api/us-boundary`: serve GeoJSON with long cache header
- [ ] `api/routes/session.py` — `POST /api/session/start`: build env + belief + strategy, return session ID
- [ ] `api/routes/session.py` — `POST /api/session/{id}/step`: one week of simulation, serialize belief
- [ ] `api/routes/session.py` — `DELETE /api/session/{id}`: explicit cleanup

### Verification
- [ ] `curl /api/results` returns 30 configs
- [ ] `curl /api/us-boundary` returns GeoJSON
- [ ] Full trial driven manually with curl: start → step × N → trial_complete

---

## Phase 2 — React Scaffold + Dashboard

### Project setup
- [ ] `npm create vite@latest web -- --template react-ts`
- [ ] Install dependencies: `react-router-dom`, `deck.gl@8.9`, `react-map-gl`, `maplibre-gl`, `plotly.js`, `react-plotly.js`, `zustand`, `@tanstack/react-query`, `pako`
- [ ] `vite.config.ts` — proxy `/api` → `http://localhost:8000`
- [ ] `tsconfig.json` — strict mode, path aliases

### Types and API client
- [ ] `src/types/api.ts` — TypeScript mirrors of all Pydantic models
- [ ] `src/api/client.ts` — base fetch wrapper with error handling
- [ ] `src/api/results.ts` — `fetchResults()` + `transformResults()` (flat dict → 30-row array)
- [ ] `src/api/session.ts` — `startSession()`, `step()`, `deleteSession()`

### Layout and routing
- [ ] `src/components/layout/NavBar.tsx` — Dashboard / Simulate tabs
- [ ] `src/components/layout/AppShell.tsx` — wraps all pages
- [ ] `src/App.tsx` — `BrowserRouter` with two routes: `/` and `/simulate`

### Dashboard charts
- [ ] `src/hooks/useResults.ts` — React Query fetch, `staleTime: Infinity`
- [ ] `src/components/charts/ChartContainer.tsx` — title + loading skeleton wrapper
- [ ] `src/components/charts/FailureHeatmap.tsx`
- [ ] `src/components/charts/MeanWeeksHeatmap.tsx`
- [ ] `src/components/charts/FailureByModeLine.tsx`
- [ ] `src/components/charts/StrategySpreadBar.tsx`
- [ ] `src/components/charts/MedianP90Heatmap.tsx`
- [ ] `src/pages/DashboardPage.tsx` — all 5 charts in vertical stack
- [ ] Visual check: charts match notebook output

---

## Phase 3 — Map Visualization

### Grid utilities
- [ ] `src/components/map/mapUtils.ts` — `GRID` constants, `getGridPositions()` singleton

### Belief decoder
- [ ] `src/workers/beliefDecoder.worker.ts` — pako inflate → Float32Array → postMessage transfer
- [ ] `src/hooks/useBeliefDecoder.ts` — wraps Worker (particles) and inline decode (grid)

### Map layers
- [ ] `src/components/map/SimulationMap.tsx` — DeckGL canvas + viewState, layer composition
- [ ] `src/components/map/USBoundaryLayer.tsx` — PolygonLayer from GeoJSON
- [ ] `src/components/map/BeliefHeatLayer.tsx` — HeatmapLayer (Gaussian) / ScatterplotLayer (grid), binary data format
- [ ] `src/components/map/ParticleLayer.tsx` — ScatterplotLayer for particle filter modes
- [ ] `src/components/map/MeasurementLayer.tsx` — distance rings + observer dots + week labels
- [ ] Smoke test: render hardcoded belief state, verify heatmap appears correctly

---

## Phase 4 — Simulation Page

### State management
- [ ] `src/store/simulationStore.ts` — Zustand store: sessionId, status, currentStep, history, decodedWeights, decodedParticles

### Simulation controls
- [ ] `src/components/simulation/StrategyModeForm.tsx` — two dropdowns, InfoGain latency note
- [ ] `src/components/simulation/StepControls.tsx` — Start / Step / Auto-play / Reset buttons
- [ ] `src/hooks/useSimulation.ts` — startSession, step, reset, auto-play interval logic

### Sidebar panels
- [ ] `src/components/simulation/WeekTimeline.tsx` — horizontal scrollable list of past measurements
- [ ] `src/components/simulation/ConvergenceChart.tsx` — uncertainty_radius vs week, log scale, threshold line
- [ ] `src/components/simulation/SimulationPanel.tsx` — composes timeline + convergence + stats display

### Page and wiring
- [ ] `src/pages/SimulationPage.tsx` — two-column layout, map + sidebar
- [ ] End-to-end test: run a full trial in the UI for each strategy

### Polish
- [ ] Box location reveal on `trial_complete: true`
- [ ] Loading skeletons during step
- [ ] Error boundary for expired/missing session (404 from API → show reset prompt)
- [ ] Auto-play speed adapts to InfoGain (500ms interval vs 1500ms default)
- [ ] Mobile layout: stack map above controls (< 768px breakpoint)

---

## Phase 5 — Build & Deploy

- [ ] Production build: `cd web && npm run build` → `web/dist/`
- [ ] FastAPI `StaticFiles` mount serving `web/dist/` from root path
- [ ] `Dockerfile` — Python image, copy `web/dist/`, uvicorn entrypoint
- [ ] `docker-compose.yml` — single service, port 8000, `data/` mounted read-only
- [ ] README updated with new run instructions (dev + Docker)
- [ ] Commit all web app code in logical steps

---

## Completed (Simulation Engine — pre-web-app work)

- [x] `src/types.py` — Point, Measurement, SearchState
- [x] `src/environment.py` — Haversine, measurement noise, US boundary sampling
- [x] `src/belief/grid.py` — GridBelief, 0.1° grid, vectorized NumPy updates
- [x] `src/belief/particle.py` — ParticleFilter, 10k particles, systematic resampling
- [x] `src/strategies/` — Fixed, Random, Max-Sep, Centroid, Info-Gain
- [x] `src/simulation.py` — single trial runner
- [x] `src/evaluator.py` — N-trial evaluator with multiprocessing
- [x] `run.py` — parallelized entry point, all 30 configs
- [x] `scripts/save_results.py` + `scripts/add_info_gain.py`
- [x] `data/results.json` — 500-trial results for 30 configs
- [x] `notebooks/analysis.ipynb` — 5 interactive Plotly charts
- [x] 18 tests passing (`pytest tests/`)
- [x] GitHub repo: https://github.com/Thinh-nguyen-03/trilateral-lab
