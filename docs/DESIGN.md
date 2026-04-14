# Trilateration Lab

Design notes for a Monte Carlo simulation of a geolocation puzzle.

---

## The Problem

A box is hidden somewhere in the continental US. Each week you pick a location and learn the distance from that point to the box in miles. No direction, just a number.

With perfect measurements, 3 non-collinear points are mathematically sufficient to pin down a location in 2D (trilateration). So 3 weeks is the floor. With rounding or noise the feasible region stays large longer. This project measures how much longer, and whether the choice of measurement locations affects convergence speed.

---

## Goals

- Quantify how measurement precision affects weeks-to-localize across different rounding levels
- Compare strategy performance under each noise condition
- Find roughly where the crossover is between precision dominating results and strategy dominating

---

## Terminology

| Term | Meaning |
|---|---|
| Box | The hidden target |
| Measurement | One (location, distance) observation |
| Strategy | The algorithm that picks where to measure from each week |
| Belief | Current probabilistic estimate of where the box is |
| Localization | When the belief region shrinks below 5 miles radius |
| Trial | One full run from box placement to localization or timeout |

---

## Architecture

```
Environment   -- geography, distance math, noise/rounding
Belief        -- tracks where the box might be given all measurements
Strategy      -- picks the next measurement location
Evaluator     -- runs N trials and collects stats
```

Each component is independently swappable.

---

### Environment

```python
class Environment:
    def sample_box_location(self) -> Point
    def measure_distance(self, observer: Point, box: Point) -> float
```

Box placement uses rejection sampling: draw from the lat/lon bounding box (24.5-49.5N, 66.9-124.7W), discard points outside a GeoJSON polygon of the continental US (Natural Earth data).

Distance is computed with the Haversine formula. Flat-Earth approximation breaks down at continental scale.

Measurement modes:

| Mode | Implementation |
|---|---|
| `EXACT` | True Haversine distance |
| `ROUND_10_MILES` | `round(d / 10) * 10` |
| `ROUND_25_MILES` | `round(d / 25) * 25` |
| `ROUND_100_MILES` | `round(d / 100) * 100` |
| `NOISY_GAUSSIAN_5` | `d + N(0, 5²)` |
| `NOISY_GAUSSIAN_25` | `d + N(0, 25²)` — 25-mile noise is likely above the localization threshold for most trials |

---

### Belief

```python
class Belief:
    def update(self, observer: Point, observed_distance: float)
    def uncertainty_radius(self) -> float  # miles
    def best_estimate(self) -> Point
```

#### Grid

Discretize the continental US into a 0.05° lat/lon grid (~150k cells). On each measurement, compute Haversine distance from every cell center to the observer and eliminate cells inconsistent with the observation.

Update rules:
- Rounding modes: eliminate cells where `round(cell_dist / N) * N != observed`
- Gaussian modes: weight cells by `exp(-0.5 * ((cell_dist - observed) / sigma)^2)`, renormalize
- EXACT: eliminate cells more than half a grid cell width from the observed distance. Haversine circles don't align neatly with cell centers so the effective tolerance is about 2 miles. Use the particle filter if that precision matters.

0.1° of longitude is not a fixed physical distance. It's shorter near the northern border than the southern border. `uncertainty_radius()` converts to miles so the 5-mile stopping criterion stays consistent across latitudes.

`uncertainty_radius` is the radius in miles of the smallest circle enclosing 95% of the probability mass around the weighted centroid.

All cell distances are computed in a single NumPy batch operation.

#### Particle Filter

N weighted particles rather than a fixed grid. Better suited for Gaussian noise modes and avoids the cell-snapping issue.

For rounding modes the likelihood is a hard binary mask — a particle either falls inside the 10-mile (or 25-mile) ring or it doesn't. With 10k uniformly initialized particles, the chance of any landing in the intersection of two narrow rings is very low, leading to particle collapse after 2 measurements. The grid belief is better for rounding modes. The particle filter is the right choice for NOISY_GAUSSIAN_* modes where the likelihood is continuous and all particles retain some weight.

---

### Strategies

```python
class Strategy:
    def choose_location(self, state: SearchState) -> Point
```

```python
@dataclass
class SearchState:
    week: int
    measurement_mode: str
    measurements: list[Measurement]
    uncertainty_radius: float
    best_estimate: Point
    belief: object  # reference to current Belief, for strategies that need it
```

Most strategies only need the summary stats. `belief` is there for strategies like info_gain that need the full distribution.

Strategies can pick any valid point inside the continental US boundary.

#### Fixed Sequence

Hard-coded sequence of geographically spread points: roughly Seattle, Miami, Chicago, LA, Dallas, ...

Baseline with no adaptation.

#### Random

Random point inside the US each week.

#### Max-Separation

Each week pick the point farthest from all previous measurement locations.

```python
def choose_location(self, state):
    previous = [m.location for m in state.measurements]
    if not previous:
        return Point(47.6, -122.3)  # Seattle
    return max(candidates, key=lambda c: min(haversine(c, p) for p in previous))
```

`candidates` is a pre-sampled grid of points covering the US. Well-spread points produce narrower intersection regions. Main comparison point for the adaptive strategies.

#### Centroid

Falls back to max-separation for all ROUND_* modes. Under heavy rounding the grid belief often produces multimodal feasible regions (disconnected arcs from multiple ring intersections), and the centroid of a multimodal distribution falls between modes — measuring there actively breaks convergence.

For EXACT and NOISY_GAUSSIAN_* modes, switches to centroid only when two conditions hold: uncertainty radius is below 200 miles, and the centroid has moved less than 50 miles since the previous measurement. The stability check catches cases where the belief is still shifting between measurement updates.

#### Information Gain

For each candidate point, estimate the expected reduction in uncertainty across likely measurement outcomes and pick the best one. Uses the Herfindahl index as a proxy: for rounding modes, `sum P(d)^2` over outcome buckets computed in O(n_cells) via bincount; for Gaussian modes, discretized into 15 distance buckets. Works with both GridBelief and ParticleFilter. Uses a coarser 3° candidate grid to keep runtime manageable.

---

### Evaluator

```python
for trial in range(num_trials):
    box = env.sample_box_location()
    belief = ParticleFilter() if gaussian_mode else GridBelief()
    strategy = create_strategy()
    strategy.reset()

    for week in range(1, MAX_WEEKS + 1):
        location = strategy.choose_location(state)
        distance = env.measure_distance(location, box)
        belief.update(location, distance)

        if belief.uncertainty_radius() < LOCALIZATION_THRESHOLD_MILES:
            record(week + GROUND_SEARCH_PENALTY)
            break
    else:
        record_failure()
```

```python
LOCALIZATION_THRESHOLD_MILES = 5
GROUND_SEARCH_PENALTY_WEEKS = 2
MAX_WEEKS_PER_TRIAL = 52
```

Output stats per configuration: mean, median, P90, P95, P99, max, failure rate.

---

## Experiment Design

5 strategies x 6 measurement modes, so 30 configs total (or 36 with `--all`). Configs are independent and run in parallel via `ProcessPoolExecutor` in `run.py`.

Localization threshold is 5 miles + 2 week ground search penalty. Tried 1 mile first but too many trials timed out under noisy conditions. 20 miles was too easy, strategies all looked the same. 5 is the right range.

---

## Repo Structure

```
trilateral-lab/
├── DESIGN.md
├── requirements.txt
├── src/
│   ├── types.py
│   ├── environment.py
│   ├── belief/
│   │   ├── grid.py
│   │   └── particle.py
│   ├── strategies/
│   │   ├── fixed.py
│   │   ├── random_strategy.py
│   │   ├── max_separation.py
│   │   ├── centroid.py
│   │   ├── hybrid.py
│   │   └── info_gain.py
│   ├── simulation.py
│   └── evaluator.py
├── data/
│   └── us_boundary.geojson
├── tests/
│   ├── test_environment.py
│   ├── test_belief.py
│   ├── test_strategies.py
│   └── test_simulation.py
└── notebooks/
    └── analysis.ipynb
```

---

## Notes

Grid belief struggles when two separate regions are both feasible early on; the centroid estimate ends up between them and is misleading. Particle filter handles this better but is only used for Gaussian modes where it actually outperforms the grid.

Belief update doesn't know about coastlines so feasible cells can bleed into ocean for boxes near the coast. Probably fine at 5 miles but worth checking.
