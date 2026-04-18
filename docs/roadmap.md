# Trilateral Lab — Feature Roadmap

This document details the planned feature set for the next phase of development.
Each feature includes a motivation, a concrete technical plan, and implementation notes
grounded in the current codebase.

---

## Progress Tracker

| # | Feature | Status | Priority |
|---|---------|--------|----------|
| F1 | [Animated Belief Heatmap](#f1-animated-belief-heatmap) | `complete` | Tier 1 |
| F2 | [Auto-Play with Speed Control](#f2-auto-play-with-speed-control) | `complete` | Tier 1 |
| F3 | [Side-by-Side Strategy Comparison](#f3-side-by-side-strategy-comparison) | `complete` | Tier 1 |
| F4 | [Convergence Curves Chart](#f4-convergence-curves-chart) | `complete` | Tier 2 |
| F5 | [Geographic Bias Analysis](#f5-geographic-bias-analysis) | `complete` | Tier 2 |
| F6 | [Entropy-Gradient Strategy](#f6-entropy-gradient-strategy) | `complete` | Tier 2 |
| F7 | [Localization Threshold Sensitivity Slider](#f7-localization-threshold-sensitivity-slider) | `complete` | Tier 2 |
| F10 | [Keyboard Shortcuts](#f10-keyboard-shortcuts) | `complete` | Tier 1 |

**Status values:** `pending` → `in-progress` → `complete` → `blocked`

---

## Tier 1 — Highest Visual Impact

---

### F1: Animated Belief Heatmap

**What it is**
Render the probability distribution over the continental US as a smooth color-gradient
raster overlay on the Leaflet/MapLibre map — replacing (or augmenting) the current
particle/circle cloud. The heatmap should visually collapse from a diffuse continental
smear on week 1 to a tight hot-spot as measurements accumulate.

**Why it matters**
The belief cloud already exists in `SimulationMap.tsx` as individual `circle` features.
This works but reads as a loose scatter of dots. A true heatmap layer — a continuous
gradient where intensity maps to probability mass — is far more intuitive and visually
arresting. It is the single biggest perceptual upgrade possible without changing the
underlying algorithm.

**How it works today**
Every `StepResponse` already carries the full compressed belief:
- Grid mode: `GridBeliefModel.weights_gz_b64` — a gzip-compressed float32 array of
  shape `(n_lats, n_lons)` = `(144, 578)` — decoded in `mapUtils.ts:decodeGridBelief()`
  into a `cells: GridCell[]` array with `{ position: [lon, lat], weight: number }`.
- Particle mode: `ParticleBeliefModel` — decoded into `{ lats, lons, weights }` arrays.

The decoded data is already available in the Zustand store as `decodedGrid` and
`decodedParticles` on every step.

**Implementation plan**

*Option A — MapLibre heatmap layer (recommended)*
MapLibre GL natively supports `type: "heatmap"` layers. The decoded grid cells can be
fed directly as GeoJSON points with a `weight` property, and MapLibre will render a
GPU-accelerated smooth heatmap automatically.

```ts
// In SimulationMap.tsx — replace the existing belief-circles layer:
<Source id="belief" type="geojson" data={beliefGeoJSON}>
  <Layer
    id="belief-heat"
    type="heatmap"
    paint={{
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'w'], 0, 0, 1, 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 8, 2],
      'heatmap-color': [
        'interpolate', ['linear'], ['heatmap-density'],
        0,    'rgba(0,0,0,0)',
        0.1,  'rgba(255,165,0,0.2)',
        0.4,  'rgba(255,100,0,0.55)',
        0.7,  'rgba(220,30,0,0.8)',
        1,    'rgba(180,0,0,1)',
      ],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 3, 12, 8, 28],
      'heatmap-opacity': 0.85,
    }}
  />
</Source>
```

The `beliefGeoJSON` structure is already being built in `SimulationMap.tsx:105-129`
for the circle layer — only the `<Layer>` component needs to change.

*Option B — Canvas raster overlay*
Decode the `(144, 578)` weight grid into a canvas ImageData and overlay it as a
MapLibre `type: "raster"` custom source. More control over pixel-level interpolation;
more complex to implement. Not needed — Option A is GPU-accelerated and sufficient.

**Files to touch**
- `web/src/components/map/SimulationMap.tsx` — swap `belief-circles` Layer for `belief-heat`
- No backend changes required

**Known edge case**
Particle mode produces sparse point data (not a dense grid). The heatmap layer still
works but will have gaps at low particle counts. Consider increasing particle count or
using KDE post-processing for Gaussian modes.

---

### F2: Auto-Play with Speed Control

**What it is**
A play/pause button + a speed multiplier selector (0.5×, 1×, 2×, 4×, 8×) that steps
through the simulation automatically at the chosen rate. Currently `useSimulation.ts`
has `startAutoPlay()` wired to a fixed interval (`600ms` for info_gain, `1200ms`
otherwise), but there is no UI to expose it beyond what is already rendered in
`StepControls.tsx`.

**Why it matters**
Watching the belief collapse in real time is the core demo experience. Without auto-play
the user must click "Next Week" up to 52 times. With it, you can set speed to 4× and
watch the whole run in 10 seconds while the heatmap animates.

**Current state**
`useSimulation.ts` already implements `startAutoPlay()` and `stopAutoPlay()`. The store
has `status: 'playing'`. The missing piece is:
1. Exposing the speed setting in the UI
2. Making `startAutoPlay()` use the selected speed instead of the hardcoded strategy-based interval

**Implementation plan**

*Step 1 — Add speed to store*
```ts
// simulationStore.ts
autoPlaySpeed: number   // multiplier: 0.5 | 1 | 2 | 4 | 8
setAutoPlaySpeed: (n: number) => void
```

*Step 2 — Wire speed to interval*
```ts
// useSimulation.ts — startAutoPlay()
const { autoPlaySpeed } = useSimulationStore.getState()
const baseMs = strategy === 'info_gain' ? 600 : 1200
const intervalMs = baseMs / autoPlaySpeed
```

*Step 3 — Add Play/Pause button to StepControls*
Replace or augment the current "Auto" button in `StepControls.tsx` with:
- A `▶ PLAY` / `⏸ PAUSE` toggle that calls `startAutoPlay()` / `stopAutoPlay()`
- A speed selector: `[0.5×] [1×] [2×] [4×] [8×]` — styled as segmented control chips
  in the Bloomberg terminal aesthetic (amber border, selected = amber fill)

**Files to touch**
- `web/src/store/simulationStore.ts` — add `autoPlaySpeed`, `setAutoPlaySpeed`
- `web/src/hooks/useSimulation.ts` — read speed from store in `startAutoPlay()`
- `web/src/components/simulation/StepControls.tsx` — Play/Pause button + speed chips
- `web/src/components/simulation/StepControls.module.css` — styles for new controls

---

### F3: Side-by-Side Strategy Comparison

**What it is**
A dedicated "Compare" mode that runs the same hidden target location through two
independently chosen strategy+mode configs simultaneously, rendered on split maps.
The user picks Config A (e.g. RANDOM / EXACT) and Config B (e.g. INFO-GAIN / EXACT),
then steps through both in sync to see diverging belief clouds and uncertainty radii.

**Why it matters**
The analysis charts prove INFO-GAIN is better in aggregate. Comparison mode makes it
visceral — you watch RANDOM scatter points aimlessly while INFO-GAIN methodically
collapses the distribution. This is the strongest possible demo of the algorithm's value.

**Architecture**

This requires two independent simulation sessions sharing a fixed `box_location`.
The existing `StartSessionRequest` already accepts an optional `box_location: PointModel`
so the second session can be seeded with the same target.

*Backend: no changes needed.* The session API already supports fixed box locations.

*Frontend: new comparison store + page*

Option A — Separate page (`/compare`): cleanest separation; both maps stacked vertically
or side by side; each panel is a self-contained instance of `<SimulationPanel>`.

Option B — Modal/overlay over the simulation page: simpler routing, but cramped.

Recommended: **Option A** — a new `/compare` route.

**State design**
```ts
// Two independent simulation slices
interface CompareState {
  left:  SimulationSlice   // strategy, mode, sessionId, history, decodedGrid, ...
  right: SimulationSlice
  sharedBoxLocation: PointModel | null
  syncedWeek: number        // both sides always show the same week
}
```

The shared box location is generated once (random or manual) and passed to both
`startSession()` calls. Stepping is synchronised — each "Next Week" fires two
API calls and both sides update together.

**Implementation plan**

1. Extract `SimulationSlice` type from `simulationStore.ts` (or duplicate the minimal
   needed state as a plain object inside a new `useCompareStore`)
2. Create `web/src/pages/ComparePage.tsx` + `.module.css` with two half-width panels
3. Create `web/src/hooks/useComparison.ts` — wraps two `useSimulation`-style controllers,
   shares the box location, synchronises stepping
4. Add `/compare` route to `web/src/App.tsx`
5. Add "COMPARE" nav link to `NavBar.tsx`

**Files to create**
- `web/src/pages/ComparePage.tsx`
- `web/src/pages/ComparePage.module.css`
- `web/src/store/compareStore.ts`
- `web/src/hooks/useComparison.ts`

**Files to touch**
- `web/src/App.tsx` — add route
- `web/src/components/layout/NavBar.tsx` — add nav link

---

### F10: Keyboard Shortcuts

**What it is**
Global keyboard bindings for the simulation page:

| Key | Action |
|-----|--------|
| `Space` | Play / Pause auto-play |
| `→` | Step forward one week |
| `←` | Step backward (navigate history) |
| `R` | Reset simulation |
| `1`–`5` | Select strategy |
| `Shift+1`–`6` | Select measurement mode |

**Why it matters**
During a live demo, clicking buttons breaks eye contact with the audience. Keyboard
control makes the simulation feel like a professional analytical tool.

**Implementation plan**

Add a `useKeyboardShortcuts` hook that attaches to `window` via `useEffect`:

```ts
// web/src/hooks/useKeyboardShortcuts.ts
export function useKeyboardShortcuts(
  { step, startAutoPlay, stopAutoPlay, reset }: ShortcutHandlers
) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return  // don't hijack form inputs
      switch (e.key) {
        case ' ':    e.preventDefault(); /* toggle play */; break
        case 'ArrowRight': step(); break
        case 'r': case 'R': reset(); break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [step, startAutoPlay, stopAutoPlay, reset])
}
```

Mount this hook inside `SimulationPage.tsx`. Add a small keyboard shortcut legend
to the `SidePanel` or as a collapsed `?` overlay on the map.

**Files to create**
- `web/src/hooks/useKeyboardShortcuts.ts`

**Files to touch**
- `web/src/pages/SimulationPage.tsx` — call the hook
- `web/src/components/simulation/SidePanel.tsx` — add shortcut legend

---

## Tier 2 — New Science / Analysis

---

### F4: Convergence Curves Chart

**What it is**
A line chart on the Analysis Dashboard showing **median uncertainty radius (miles) vs.
week number (1–52)**, one curve per strategy. This shows *how fast* each strategy
narrows down the target, not just the binary pass/fail outcome captured by the current
heatmaps.

**Why it matters**
The current charts (failure rate, mean weeks, median/P90 weeks) all summarize the
*final outcome*. Convergence curves reveal the trajectory — does FIXED plateau early?
Does INFO-GAIN's advantage compound or emerge only late? These are scientifically
distinct questions the current dashboard cannot answer.

**Data gap — what needs to be added**
The current `results.json` aggregates only final-outcome stats (`mean`, `median`, `p90`,
`failure_rate`) per strategy/mode. It does not store per-week uncertainty radius data.

To produce convergence curves you need either:
- *Option A*: Re-run all simulations while logging `uncertainty_radius` at every week
  and storing `[week → median_radius]` per strategy/mode config.
- *Option B*: Expose a streaming endpoint that aggregates on-the-fly from a saved
  full-trial log file.

**Recommended: Option A** — store the curve data at simulation time.

*Backend changes*

Extend `TrialResult` in `src/simulation.py`:
```python
@dataclass
class TrialResult:
    localized: bool
    weeks: int
    radius_by_week: list[float]  # uncertainty_radius at each week, len ≤ 52
```

Extend `src/evaluator.py` to aggregate `radius_by_week` across trials:
```python
# per (strategy, mode) — median radius at week w across all trials
median_radius_curve: list[float]  # shape: [52]
```

Extend `scripts/save_results.py` to include `median_radius_curve` in `results.json`.

*Frontend changes*

New chart component `web/src/components/charts/ConvergenceCurves.tsx`:
```tsx
// x-axis: weeks 1–52
// y-axis: uncertainty radius (miles, log scale optional)
// one scatter+line trace per strategy, colored with BLOOMBERG_COLORS
// separate subplots or faceted by measurement mode (use plotly grid layout)
```

Add to `DashboardPage.tsx` in a new section "§03 CONVERGENCE TRAJECTORIES".

**Files to touch (backend)**
- `src/simulation.py` — add `radius_by_week` to `TrialResult`
- `src/evaluator.py` — aggregate curve data
- `scripts/save_results.py` — serialize curves

**Files to create (frontend)**
- `web/src/components/charts/ConvergenceCurves.tsx`

**Files to touch (frontend)**
- `web/src/types/api.ts` — add `median_radius_curve` to `ResultRow`
- `web/src/pages/DashboardPage.tsx` — add new chart section

---

### F5: Geographic Bias Analysis

**What it is**
A breakdown of strategy performance by geographic region of the continental US.
Bucket each trial's `box_location` into one of five regions (NW, SW, Central, NE, SE)
and compute failure rate and mean weeks per region per strategy. Surface this as a
small multiples bar chart or a choropleth on the Analysis Dashboard.

**Why it matters**
The continental US is not geographically uniform — coastlines constrain candidate
locations, Gaussian noise scales differently over sparse vs. dense candidate grids,
and the grid's western cells are sparser near the Pacific. Spatial blind spots in
a strategy's choice logic would show up here and are scientifically interesting.

**Data gap**
The current `results.json` has aggregate stats only — individual trial `box_location`
values are not stored. This requires a resimulation pass.

**Region definitions**

```python
def classify_region(lat: float, lon: float) -> str:
    if lon < -104:
        return 'NW' if lat >= 40 else 'SW'
    elif lon > -80:
        return 'NE' if lat >= 38 else 'SE'
    else:
        return 'CENTRAL'
```

**Backend changes**
- `src/simulation.py` — store `box_location` in `TrialResult`
- `src/evaluator.py` — pass through `box_location`; compute per-region stats
- `scripts/save_results.py` — add `regional_stats` to `results.json`

**Frontend changes**
New chart component `web/src/components/charts/RegionalBreakdownBar.tsx`:
- Grouped bar chart: x = region, y = failure rate, color = strategy
- Or a 5-cell mini-map where each cell color-codes the best strategy per region

**Files to touch (backend)**
- `src/simulation.py`, `src/evaluator.py`, `scripts/save_results.py`

**Files to create (frontend)**
- `web/src/components/charts/RegionalBreakdownBar.tsx`

**Files to touch (frontend)**
- `web/src/types/api.ts` — new `RegionalRow` type
- `web/src/api/results.ts` — parse regional stats
- `web/src/pages/DashboardPage.tsx` — add section

---

### F6: Entropy-Gradient Strategy

**What it is**
A new search strategy that selects the next measurement location by maximizing expected
**Shannon entropy reduction** in the belief distribution, rather than the Herfindahl
index proxy currently used by `InfoGainStrategy`.

**Why it matters**
`InfoGainStrategy` uses sum-of-squared-weights as a surrogate for information gain
(equivalent to minimizing Rényi entropy of order 2, not Shannon entropy). The true
information-theoretic optimum minimizes `H = −Σ p·log(p)`. For Gaussian noise modes
where the posterior is smooth and multimodal, Shannon entropy may diverge from the
Herfindahl index. A new row in the analysis charts either validates that the Herfindahl
approximation is tight (interesting null result) or reveals a genuine improvement
(interesting positive result).

**Algorithm**

For each candidate location `c` from `get_candidates()`:

```
Expected H after measuring at c
  = Σ_d P(observe d | c) · H(belief | d measured at c)
```

For rounding modes, `d` takes discrete values bucketed by the rounding step.
For Gaussian modes, discretize into 15 distance buckets (same as current approach).

The computational structure mirrors `InfoGainStrategy._herfindahl()` but replaces
`np.sum(group_w ** 2)` with `np.sum(-group_p * np.log(group_p + 1e-30))`.

**Implementation**

```python
# src/strategies/entropy_gradient.py
import numpy as np
from ..types import Point, SearchState
from .base import Strategy
from .candidates import get_candidates
from .max_separation import MaxSeparationStrategy
from ..environment import haversine_vec

class EntropyGradientStrategy(Strategy):
    """Minimizes expected Shannon entropy of posterior (vs Herfindahl in InfoGain)."""

    def __init__(self, candidate_step: float = 3.0):
        self.candidate_step = candidate_step
        self._fallback = MaxSeparationStrategy()

    def choose_location(self, state: SearchState) -> Point:
        belief = state.belief
        # ... extract w, lats, lons from GridBelief or ParticleFilter (same as InfoGain)
        candidates = get_candidates(step=self.candidate_step)
        best, best_score = None, float('inf')
        for c in candidates:
            score = self._expected_entropy(c, w, lats, lons, state.measurement_mode)
            if score < best_score:
                best_score, best = score, c
        return best

    def _expected_entropy(self, observer, w, lats, lons, mode) -> float:
        dists = haversine_vec(observer.lat, observer.lon, lats, lons)
        # bucket by mode (same bucketing as InfoGain)
        ids = ...  # same logic as _herfindahl
        group_w = np.bincount(ids, weights=w)
        total = group_w.sum()
        if total < 1e-10: return float('inf')
        group_p = group_w / total
        # Shannon entropy (nats)
        return float(-np.sum(group_p * np.log(group_p + 1e-30)))
```

**Integration**
- Add to `VALID_STRATEGIES` in `api/models.py`
- Register in `api/routes/session.py` strategy factory
- Add to `STRATEGY_ORDER` in `web/src/api/results.ts` and all chart label arrays
- Re-run Monte Carlo with new strategy to get data for analysis charts

**Files to create**
- `src/strategies/entropy_gradient.py`

**Files to touch**
- `src/strategies/__init__.py`
- `api/models.py` — add to `VALID_STRATEGIES`
- `api/routes/session.py` — add to factory
- `web/src/api/results.ts` — extend `STRATEGY_ORDER`
- Chart label arrays in all 4 heatmap/line chart components

---

### F7: Localization Threshold Sensitivity Slider

**What it is**
The localization threshold (currently hardcoded as `LOCALIZATION_THRESHOLD_MILES = 5`
in `src/simulation.py`) determines when a trial is declared "localized." Add a slider
on the Analysis Dashboard that recomputes failure rates and mean weeks across a range
of thresholds (e.g. 2–25 miles) and rerenders all charts in real time.

**Why it matters**
The 5-mile threshold is arbitrary — it represents an assumed ground-search radius.
A researcher or decision-maker might ask: "If we can only afford a 10-mile ground
search, how much worse are our odds? What if we have 25-mile ground search capability?"
This slider answers the question without re-running simulations.

**Data gap — what needs to be added**
Real-time recomputation from stored threshold requires storing the raw `weeks_to_localize`
distribution per trial (not just aggregated stats). Currently `results.json` stores only
`mean`, `median`, `p90`, `failure_rate` — which were computed against the fixed 5-mile
threshold.

To support slider recomputation, store the full sorted distribution:

```json
{
  "strategy": "max_separation",
  "mode": "ROUND_25_MILES",
  "weeks_distribution": [5, 5, 7, 8, 12, ..., 52, 52]  // sorted, len = n_trials
}
```

The frontend then recomputes:
```ts
function recompute(dist: number[], thresholdMiles: number, rawUncertaintyByWeek: ...) {
  // For a threshold slider this actually requires per-trial radius curves...
  // Simpler approximation: treat the stored 'weeks' as localization week at 5mi;
  // scaling up the threshold delays localization, but the exact mapping requires
  // per-trial radius data.
}
```

**Note**: True per-threshold recomputation requires per-trial radius-by-week data
(also needed for F4). If F4 is implemented first, F7 can piggyback on that data.
Without it, F7 can show a precomputed multi-threshold heatmap (run 5 threshold
values at simulation time and store all 5 stat sets).

**Implementation plan (precomputed variant — simpler)**
Run `save_results.py` for thresholds `[2, 5, 10, 15, 25]` miles and store as:
```json
{ "threshold_2": {...}, "threshold_5": {...}, "threshold_10": {...}, ... }
```
The slider snaps to these 5 values. No recomputation at runtime.

**Files to touch (backend)**
- `scripts/save_results.py` — run multiple threshold passes
- `src/evaluator.py` — accept threshold parameter

**Files to create (frontend)**
- `web/src/components/charts/ThresholdSensitivityChart.tsx`

**Files to touch (frontend)**
- `web/src/types/api.ts` — multi-threshold result shape
- `web/src/pages/DashboardPage.tsx` — add slider + chart section

---

## Implementation Order

The recommended sequence balances visual impact with dependency constraints:

```
F10 (keyboard) ─────────────────────────────────────── standalone, 1–2h
F2  (auto-play speed) ──────────────────────────────── small store + UI, 2–3h
F1  (belief heatmap) ───────────────────────────────── frontend only, 3–4h
F6  (entropy strategy) ─────────────────────────────── backend + resim, 4–6h
F4  (convergence curves) ───────────────────────────── backend resim + new chart
F5  (geographic bias) ──────────────────────────────── depends on F4 data pipeline
F7  (threshold slider) ─────────────────────────────── depends on F4 data pipeline
F3  (side-by-side compare) ─────────────────────────── largest frontend refactor, last
```

---

*Last updated: 2026-04-17*
