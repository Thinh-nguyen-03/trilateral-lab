# Trilateration Lab

Monte Carlo simulation of a geolocation puzzle. A box is hidden somewhere in the continental US. Each week you pick a location and learn the distance to the box in miles — no direction, just a number. The question: how many weeks does it take to narrow the location down to within 5 miles, and does your choice of measurement strategy matter?

## The experiment

5 strategies × 6 measurement modes = 30 configurations, each run for 500 trials.

**Strategies**
| Strategy | Description |
|---|---|
| Fixed | Hard-coded geographic sequence: Seattle → Miami → Chicago → LA → Dallas → ... |
| Random | Random point inside the US each week |
| Max-Sep | Each week picks the point farthest from all previous measurement locations |
| Centroid | Closes in on the current best estimate once the belief is concentrated enough |
| Info-Gain | Picks the location that minimizes expected surviving probability mass (Herfindahl index proxy) |

**Measurement modes**
| Mode | Description |
|---|---|
| Exact | True Haversine distance |
| Round 10mi | Distance rounded to nearest 10 miles |
| Round 25mi | Distance rounded to nearest 25 miles |
| Round 100mi | Distance rounded to nearest 100 miles |
| Gaussian σ=5 | Distance + N(0, 5²) noise |
| Gaussian σ=25 | Distance + N(0, 25²) noise |

## Key findings

- Under low noise (Exact, Round 10mi, Gaussian σ=5), all strategies localize in 5–7 weeks with near-zero failure. Strategy choice barely matters.
- Under heavy rounding (Round 100mi), Info-Gain cuts mean time-to-localize from 35 weeks to 12 and failure rate from 19% to 3%. This is the clearest case where measurement placement is the deciding factor.
- Max-Sep is the best all-round strategy: simple, 0% failure on anything up to Round 25mi, and competitive everywhere else.
- Gaussian σ=25 is near-unreachable (~35% failure floor) regardless of strategy — noise dominates completely.

## Architecture

```
src/
├── types.py           # Point, Measurement, SearchState
├── environment.py     # Haversine distance, measurement noise, US boundary sampling
├── belief/
│   ├── grid.py        # 0.1° lat/lon grid (~144k cells), vectorized NumPy updates
│   └── particle.py    # Particle filter for Gaussian noise modes
├── strategies/
│   ├── fixed.py
│   ├── random_strategy.py
│   ├── max_separation.py
│   ├── centroid.py
│   ├── hybrid.py
│   └── info_gain.py   # Herfindahl index via bincount, O(n_cells) per candidate
├── simulation.py      # Single trial runner
└── evaluator.py       # N-trial evaluator with multiprocessing
```

Grid belief is used for all rounding and exact modes. Particle filter is used for Gaussian noise modes where continuous likelihood keeps all particles alive.

## Running it

```bash
pip install -r requirements.txt

# Fetch the US boundary polygon (required for accurate box placement)
python scripts/fetch_boundary.py

# Run the experiment (500 trials, ~2 minutes with parallelism)
python run.py 500

# Include info_gain (slower — ~5s/trial on Gaussian σ=25)
python run.py 500 --all
```

Output is a results table printed to stdout. Results are also cached to `data/results.json` via:

```bash
python scripts/save_results.py 500
python scripts/add_info_gain.py
```

## Analysis notebook

`notebooks/analysis.ipynb` loads `data/results.json` and produces interactive Plotly charts:
- Failure rate heatmap (strategy × mode)
- Mean weeks heatmap
- Failure rate vs noise level (line chart, click legend to isolate strategies)
- Strategy spread per mode (how much does strategy choice matter?)
- Median and P90 side by side

Charts are saved as self-contained HTML files in `data/`.

## Tests

```bash
pytest tests/
```

18 tests covering environment math, belief updates, strategy outputs, and trial mechanics.
