# Trilateration Lab

Monte Carlo simulation of a geolocation puzzle. A box is hidden somewhere in the continental US. Each week you pick a location and learn the distance to the box in miles — no direction, just a number. The question: how many weeks does it take to narrow the location down to within 5 miles, and does your choice of measurement strategy matter?

## Live App

Three pages:

| Page | What it does |
|---|---|
| **Dashboard** | Pre-computed analysis across all 6 strategies × 6 sensor modes × 500 trials |
| **Simulation** | Live interactive simulation — watch the belief heatmap collapse in real time |
| **Compare** | Side-by-side race between any two strategy/mode configurations |

---

## The Experiment

6 strategies × 6 measurement modes = 36 configurations, each run for 500 trials with a 52-week timeout and a 5-mile localization threshold.

### Strategies

| Strategy | Description |
|---|---|
| **Fixed** | Hard-coded geographic sequence: Seattle → Miami → Chicago → LA → Dallas → … |
| **Random** | Random CONUS point each week |
| **Max-Sep** | Each week picks the point farthest from all previous measurement locations |
| **Centroid** | Closes in on the current best estimate once the belief concentrates |
| **Info-Gain** | Minimizes expected surviving probability mass (Herfindahl index proxy) |
| **Entropy-Grad** | Maximizes Shannon entropy of the distance measurement distribution — seeks the most informative split of the belief |

### Measurement Modes

| Mode | Description |
|---|---|
| Exact | True Haversine distance |
| Round ±10mi | Distance rounded to nearest 10 miles |
| Round ±25mi | Distance rounded to nearest 25 miles |
| Round ±100mi | Distance rounded to nearest 100 miles |
| Gaussian σ=5 | Distance + N(0, 5²) noise |
| Gaussian σ=25 | Distance + N(0, 25²) noise |

---

## Key Findings

- Under low noise (Exact, Round ±10mi, Gaussian σ=5), all strategies localize in 5–7 weeks with near-zero failure. Strategy choice barely matters.
- Under heavy rounding (Round ±100mi), Info-Gain cuts mean time-to-localize from 35 weeks to 12 and failure rate from 19% to 3%. This is the clearest case where placement is decisive.
- Max-Sep is the best all-round strategy: simple, 0% failure up to Round ±25mi, and competitive everywhere else.
- Gaussian σ=25 hits a ~35% failure floor regardless of strategy — noise dominates completely.
- Entropy-Gradient performs similarly to Info-Gain under heavy noise but uses a different information criterion (Shannon entropy vs. Herfindahl index).

---

## Dashboard Charts

1. **Failure rate heatmap** — % of trials hitting the 52-week timeout, strategy × mode
2. **Mean weeks heatmap** — average weeks to localize (timed-out trials count as 52)
3. **Strategy degradation** — how each strategy's failure rate rises as sensor precision drops
4. **Strategy spread** — how much strategy choice matters per mode (best vs. worst gap)
5. **Median / P90 distribution** — typical vs. worst-case convergence per config
6. **Convergence trajectories** — median uncertainty radius over time with optional Cramér-Rao lower bound overlay
7. **Geographic bias** — failure rate broken down by CONUS region (NW / SW / Central / NE / SE)
8. **Threshold sensitivity** — how failure rate changes as the localization radius varies from 2 to 25 miles
9. **Adversarial landscape** — minimax heatmap: where on the map does each strategy fail worst?

---

## Simulation Page

- **Live belief heatmap** rendered via MapLibre GL — probability mass collapses from a continental smear to a tight hot-spot
- **Particle filter** for Gaussian noise modes (10k particles); **grid belief** (144k cells, 0.1° resolution) for all rounding/exact modes
- **Auto-play** with adjustable speed (1× – 16×)
- **Keyboard shortcuts**: `Space` play/pause, `→` step, `R` reset, `1`–`6` speed presets
- **Distance rings** drawn at each observer location, color-coded by week
- **Measurement path** connecting observer locations in sequence
- **CRLB overlay** — Cramér-Rao lower bound as a dashed reference circle showing the information-theoretic floor
- **Interactive mode** — click the map yourself to place measurements

---

## Compare Page

- **Side-by-side maps** running two strategy/mode configs simultaneously against the same target
- **ADVERSARIAL seed** — pins the target at the worst-case location for Config A's strategy (from the minimax sweep)
- **Random target** regeneration with a single click
- **Verdict badge** in the header — shows which config won and by how many weeks
- **Timeline scrubber** — replay any week of the run on both maps simultaneously
- **Convergence window** — floating SVG chart showing both uncertainty curves on a log scale, with a 5-mile threshold line and week axis
- **5-Race scoreboard** — runs 5 head-to-head races, tracks wins/ties/losses, shows per-race week counts and averages
- **Target marker** visible on both maps from the start

---

## Architecture

```
src/
├── types.py
├── environment.py          Haversine distance, noise, CONUS boundary sampling
├── belief/
│   ├── grid.py             0.1° lat/lon grid (~144k cells), vectorized NumPy
│   └── particle.py         Particle filter for Gaussian noise modes
├── strategies/
│   ├── fixed.py
│   ├── random_strategy.py
│   ├── max_separation.py
│   ├── centroid.py
│   ├── info_gain.py        Herfindahl index, O(n_cells) per candidate
│   └── entropy_gradient.py Shannon entropy of distance distribution
├── simulation.py
└── evaluator.py            N-trial evaluator with multiprocessing

api/
├── main.py                 FastAPI app — serves React build + API routes
├── models.py               Pydantic request/response types
├── session_store.py        In-memory session dict with TTL cleanup
├── serializers.py          Belief → gzip float32 → base64
└── routes/
    ├── results.py          GET /api/results
    ├── session.py          POST/DELETE /api/session/*
    ├── adversarial.py      GET /api/adversarial
    └── crlb.py             GET /api/crlb

web/src/
├── pages/
│   ├── DashboardPage.tsx
│   ├── SimulationPage.tsx
│   └── ComparePage.tsx
├── components/
│   ├── charts/             9 Plotly/SVG chart components
│   ├── map/                SimulationMap, mapUtils
│   ├── compare/            CompareMapPanel
│   └── simulation/         SimulationPanel, StepControls, StrategyModeForm
├── hooks/                  useResults, useSimulation, useComparison, useRaces, useCrlb, useAdversarial
└── store/                  simulationStore, compareStore (Zustand)
```

Grid belief for all rounding/exact modes. Particle filter for Gaussian noise modes.

---

## Running Locally

```bash
pip install -r requirements.txt

# Fetch the US boundary polygon (required once)
python scripts/fetch_boundary.py

# Generate pre-computed results (500 trials, ~2 min)
python scripts/save_results.py 500

# Generate adversarial placement data (minimax sweep, ~5 min)
python scripts/adversarial_placement.py

# Start the API server
uvicorn api.main:app --reload

# In a separate terminal, start the frontend dev server
cd web && npm install && npm run dev
```

The frontend proxies `/api` → `localhost:8000` in dev mode.

---

---

## UI Guide

### Navigation

The top nav bar has three links: **DASHBOARD**, **SIMULATION**, and **COMPARE**. The active page is highlighted in green.

---

### Simulation Page

The simulation page runs a single live trial — one hidden target, one strategy, step by step.

#### Top bar

| Element | What it does |
|---|---|
| **◀ / ▶ toggle** | Collapse or expand the left side panel to give the map more room |
| **Status badge** | Shows the current trial state: STANDBY → MISSION ACTIVE / AUTO-RUNNING → COMPLETE / TIMEOUT |
| **W01 / 52 counter** | Current week number out of the 52-week maximum, shown during a run |
| **Result note** | On completion, shows `LOCALIZED W{n}` (success) or `TIMEOUT W52` (failure) |
| **CONUS / GRID 144K / PARTICLE 10K** | Read-only spec tags: geographic scope, grid resolution (144k cells at 0.1°), and particle count for Gaussian noise modes |

#### Side panel — CONFIGURATION section

| Control | What it does |
|---|---|
| **STRATEGY** dropdown | Select which algorithm picks observer locations each week. Locked once a trial starts. Options: MANUAL, FIXED SEQUENCE, RANDOM, MAX-SEPARATION, CENTROID, INFO-GAIN, ENTROPY-GRAD, LEARNED |
| **SENSOR MODE** dropdown | Select the measurement noise model. Locked once a trial starts |
| **TARGET PLACEMENT — RANDOM** | Places the hidden target at a random CONUS location on launch |
| **TARGET PLACEMENT — PICK ON MAP** | Lets you click the map to pin the target before launching; the pin updates as you click |
| **↻ button** | (Random mode only) Randomizes the target location again without launching |
| **Coordinate readout** | Shows the current target's lat/lon preview |

#### Side panel — CONTROLS section

| Control | What it does |
|---|---|
| **▶ LAUNCH TRIAL** | Initializes a session on the server, places the target, and takes the first measurement step |
| **▶ STEP** | Advances the simulation by exactly one week |
| **▶▶ AUTO-RUN** | Runs the simulation automatically at the selected speed until localized or timed out |
| **PAUSE** | Stops auto-run; you can resume with AUTO-RUN or advance manually with STEP |
| **↺ RESET SYSTEM** | Clears the trial and returns to STANDBY |
| **SPEED chips** (0.5× 1× 2× 4× 8×) | Sets the auto-run interval. 0.5× is slowest (one step every 2s); 8× is fastest |

#### Side panel — TELEMETRY section

Live readouts updated after each step:

| Field | Meaning |
|---|---|
| **WEEK** | Steps taken so far |
| **UNCERTAINTY** | Current uncertainty radius in miles — the effective search area radius. Turns green at ≤ 5 mi |
| **EST. LAT / EST. LON** | Coordinates of the current best estimate (highest-probability point in the belief) |
| **Result banner** | Green OK on localization, red XX on timeout, with the true box coordinates |
| **BENCHMARK** (manual mode only) | Compares your click-by-click week count against the mean weeks of Max-Sep and Info-Gain for the same sensor mode |
| **STEP LOG** | Scrollable list of every measurement: observer location, distance reading, and uncertainty after update |

#### Side panel — SHORTCUTS section

| Key | Action |
|---|---|
| `Space` | Play / Pause auto-run |
| `→` | Step one week |
| `R` | Reset trial |

#### Map

| Visual element | Meaning |
|---|---|
| **Belief heatmap** | Orange → red gradient showing where the algorithm thinks the target is. Tighter = more confident |
| **Colored rings** | Each ring is one measurement: centered on the observer location, radius = reported distance. Color cycles green → yellow → red by week number |
| **Measurement path** | Dashed line connecting observer locations in order, showing the search trajectory |
| **Red dot** | Current best estimate — the highest-probability cell |
| **Green dot** | True target location (revealed on completion) |
| **CRLB circle** | Dashed white circle showing the Cramér-Rao lower bound — the information-theoretic minimum uncertainty achievable given the measurements so far. Only available for exact-distance mode |
| **Coordinate readout** (bottom center) | `CONUS · LAT · LON` — updates to show the cursor position as you hover the map |

---

### Compare Page

The compare page runs two configurations simultaneously against the same target so you can measure which strategy or sensor mode wins.

#### Header bar

| Element | What it does |
|---|---|
| **TARGET coord** | Lat/lon of the shared target used by both configs |
| **↻ button** | Randomizes the shared target location (only available before a run) |
| **ADVERSARIAL button** | Looks up the minimax data and pins the target at the worst-case location for Config A's strategy — the spot where A historically struggles most |
| **Verdict badge** | After both runs complete: `A WINS by Nwk`, `B WINS by Nwk`, or `TIED` |
| **Timeline scrubber** | After completion: a week slider that scrubs both maps and the convergence chart simultaneously. The label shows the current week. The END button jumps back to the final state |

#### Config bar

Two groups (CONFIG A in cyan, CONFIG B in amber), each with:

| Control | What it does |
|---|---|
| **STRATEGY** dropdown | Which algorithm to run for this side |
| **SENSOR MODE** dropdown | Which noise model to use for this side |

Both dropdowns are locked once a run starts.

#### Control buttons

| Button | When shown | What it does |
|---|---|---|
| **▶ LAUNCH BOTH** | Before run | Starts both sessions simultaneously against the shared target |
| **RUN 5 RACES** | Before run | Runs 5 independent head-to-head races, each with a fresh random target, and records the winner of each |
| **N/total STOP** | During races | Shows race progress and cancels the remaining races |
| **▶ STEP** | During run (paused) | Advances both sides one week |
| **▶▶ AUTO-RUN** | During run (paused) | Auto-advances both sides until both complete |
| **PAUSE** | During auto-run | Pauses both sides |
| **↺ RESET** | After completion | Clears both sides and returns to config state |

#### Maps

Two maps side by side, each showing the same layers as the simulation page (heatmap, rings, path, best estimate, target marker) but for their respective strategy/mode config. Both maps share the same target — the green dot in the same geographic location on each side.

#### CONVERGENCE floating window (bottom center)

A collapsible panel showing both uncertainty curves on a single log-scale chart:

| Element | Meaning |
|---|---|
| **Cyan line (A)** | Config A's uncertainty radius over time |
| **Amber line (B)** | Config B's uncertainty radius over time |
| **Red dashed line** | 5-mile localization threshold — curves that cross this line have localized |
| **Y-axis** (log scale, mi) | Uncertainty radius: 1 mi at bottom, 1000 mi at top |
| **X-axis** | Week number: W0 through W52 |
| **Vertical cursor** | Tracks the timeline scrubber position |
| **▼ / ▶ header** | Click to collapse or expand the window |

#### SCOREBOARD floating window (bottom right)

Shown after starting races. Tracks all head-to-head results:

| Element | Meaning |
|---|---|
| **A WINS / TIED / B WINS** tally | Total wins for each side across all completed races |
| **Win-rate bar** | Proportional bar: cyan = A wins, gray = ties, amber = B wins |
| **Race log** | Per-race breakdown: `R1 A WINS W6 vs W11`, etc. |
| **AVG WKS** | Mean weeks-to-localize for A and B across completed races |
| **CLR button** | Clears the scoreboard |

---

### Dashboard Page

A read-only analysis page. All charts are pre-computed from 500 trials per configuration and update by clicking the filter chips above each section — no controls affect the underlying data.

#### Section 01 — Failure & Convergence Matrices

Two heatmaps, strategies on rows and sensor modes on columns:

- **Failure rate** — percentage of the 500 trials that hit the 52-week timeout without localizing. Red = high failure.
- **Mean weeks** — average weeks to localize across all 500 trials; timed-out trials count as 52. Brighter = faster.

#### Section 02 — Strategy Degradation Under Noise

Line chart: each line is one strategy, x-axis is sensor mode (ordered by severity), y-axis is failure rate. Shows how quickly each strategy falls apart as measurement quality drops. Click a strategy in the legend to isolate it.

#### Section 03 — Impact & Distribution Analysis

- **Strategy spread** — bar chart showing the gap between the best and worst strategy per mode. A tall bar means strategy choice is decisive in that mode; a flat bar means all strategies perform similarly.
- **Median / P90** — heatmap showing median weeks (typical case) and P90 weeks (worst 10%) side by side. P90 ≥ 52 means at least 10% of trials timed out.

#### Section 04 — Convergence Trajectories

Line chart of median uncertainty radius over time, one line per strategy. Use the **mode filter chips** above the chart to switch sensor modes.

If Cramér-Rao data is available, a dashed white line shows the CRLB — the information-theoretic floor below which no unbiased estimator can go given the measurements.

#### Section 05 — Geographic Bias Analysis

Grouped bar chart: failure rate broken down by CONUS region (NW / SW / Central / NE / SE) for each strategy. Reveals which strategies have geographic blind spots. Use the mode filter chips to switch modes.

#### Section 06 — Localization Threshold Sensitivity

Line chart: failure rate vs. localization threshold (2 / 5 / 10 / 15 / 25 miles). Shows how sensitive success is to how precisely you need to locate the target. Use the mode filter chips to switch modes.

#### Section 07 — Adversarial Landscape

Heatmap overlaid on a CONUS grid. Each cell shows the mean weeks when the target is pinned at that location. The diamond marker shows the worst-case cell — where the selected strategy performs worst.

Use the **strategy chips** to switch strategy and the **mode chips** to switch sensor mode.

---

## Tests

```bash
pytest tests/
```

Covers environment math, belief updates (grid + particle), strategy outputs, and trial mechanics.
