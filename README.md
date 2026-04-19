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

## Tests

```bash
pytest tests/
```

Covers environment math, belief updates (grid + particle), strategy outputs, and trial mechanics.
