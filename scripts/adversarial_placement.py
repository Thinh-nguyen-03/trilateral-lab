#!/usr/bin/env python
"""
For each (strategy, mode), sweep a coarse grid of candidate box locations and
record the mean weeks-to-localize when the box is pinned at each candidate.
This turns the Monte Carlo study into a minimax view: "how bad is the worst
case for each strategy?"

Output:
    data/adversarial.json

Structure:
    {
      "lat_grid": [..],   # sorted ascending
      "lon_grid": [..],   # sorted ascending
      "strategies": [..], # list of strategy names
      "modes": [..],      # list of modes
      "cells": {
        "<strategy>|<mode>": {
          "mean_weeks":    [[m_at_(lat0,lon0), m_at_(lat0,lon1), ..], ..],
          "failure_rate":  [[..], ..],
          "worst_box":     {"lat": .., "lon": .., "mean_weeks": ..}
        }
      }
    }

Usage:
    python scripts/adversarial_placement.py              # K=25 trials per cell
    python scripts/adversarial_placement.py 50           # K=50 trials per cell
"""
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# Coarser grid keeps runtime reasonable: ~6x5 = 30 cells per config.
LAT_MIN, LAT_MAX = 27.0, 47.0
LON_MIN, LON_MAX = -122.0, -72.0
LAT_STEP = 4.0
LON_STEP = 10.0

# info_gain is excluded: its O(n_candidates * n_cells) cost per step makes a
# K-trial sweep across a full CONUS grid intractable in-process. max_separation,
# centroid, and random still give a meaningful minimax picture.
STRATEGIES = ["fixed", "random", "max_separation", "centroid"]
MODES = [
    "EXACT",
    "ROUND_25_MILES",
    "ROUND_100_MILES",
    "NOISY_GAUSSIAN_5",
]


def _lat_grid():
    lats, v = [], LAT_MIN
    while v <= LAT_MAX + 1e-9:
        lats.append(round(v, 3))
        v += LAT_STEP
    return lats


def _lon_grid():
    lons, v = [], LON_MIN
    while v <= LON_MAX + 1e-9:
        lons.append(round(v, 3))
        v += LON_STEP
    return lons


def _cell_worker(args):
    """Run K trials for one (strategy, mode, box) cell."""
    strategy_name, mode, lat, lon, k, seed = args
    import random
    import numpy as np
    from src.evaluator import _build_registry
    from src.environment import Environment, _in_continental_us
    from src.simulation import run_trial
    from src.types import Point

    # Skip cells outside CONUS
    if not _in_continental_us(lat, lon):
        return strategy_name, mode, lat, lon, None

    random.seed(seed)
    np.random.seed(seed)

    strategy = _build_registry()[strategy_name]()
    env = Environment(mode)
    box = Point(lat=lat, lon=lon)

    results = [run_trial(strategy, env, box=box) for _ in range(k)]
    weeks = [r.weeks for r in results]
    failures = sum(1 for r in results if not r.localized)
    return strategy_name, mode, lat, lon, {
        "mean_weeks":   float(np.mean(weeks)),
        "failure_rate": failures / len(results),
    }


def main():
    k_trials = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    lats = _lat_grid()
    lons = _lon_grid()

    # Build the full job list. Seed each cell differently but deterministically.
    jobs = []
    seed = 0
    for s in STRATEGIES:
        for m in MODES:
            for lat in lats:
                for lon in lons:
                    jobs.append((s, m, lat, lon, k_trials, seed))
                    seed += 1

    n_workers = min(len(jobs), os.cpu_count() or 4)
    print(f"Running {len(jobs)} cells x {k_trials} trials ({n_workers} workers)...")

    # Initialize output structure
    def _empty_matrix():
        return [[None for _ in lons] for _ in lats]

    cells = {
        f"{s}|{m}": {
            "mean_weeks":   _empty_matrix(),
            "failure_rate": _empty_matrix(),
        }
        for s in STRATEGIES for m in MODES
    }

    done = 0
    total = len(jobs)
    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        for s, m, lat, lon, stats in pool.map(_cell_worker, jobs, chunksize=8):
            i = lats.index(lat)
            j = lons.index(lon)
            key = f"{s}|{m}"
            if stats is not None:
                cells[key]["mean_weeks"][i][j]   = stats["mean_weeks"]
                cells[key]["failure_rate"][i][j] = stats["failure_rate"]
            done += 1
            if done % 50 == 0 or done == total:
                print(f"  {done}/{total}", flush=True)

    # Compute worst-case box per (strategy, mode)
    for key, entry in cells.items():
        worst = None
        for i, lat in enumerate(lats):
            for j, lon in enumerate(lons):
                mw = entry["mean_weeks"][i][j]
                if mw is None:
                    continue
                if worst is None or mw > worst["mean_weeks"]:
                    worst = {"lat": lat, "lon": lon, "mean_weeks": mw}
        entry["worst_box"] = worst

    out = {
        "lat_grid": lats,
        "lon_grid": lons,
        "strategies": STRATEGIES,
        "modes": MODES,
        "k_trials_per_cell": k_trials,
        "cells": cells,
    }

    dest = Path(__file__).parent.parent / "data" / "adversarial.json"
    with open(dest, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Saved {dest}")


if __name__ == "__main__":
    main()
