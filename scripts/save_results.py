#!/usr/bin/env python
"""
Compute results for all strategy/mode configs and save to data/results.json.
The notebook loads this file instead of re-running the evaluator every time.

Usage:
    python scripts/save_results.py          # 500 trials
    python scripts/save_results.py 1000     # custom trial count
"""
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

STRATEGIES = ["fixed", "random", "max_separation", "centroid"]
MODES = [
    "EXACT",
    "ROUND_10_MILES",
    "ROUND_25_MILES",
    "ROUND_100_MILES",
    "NOISY_GAUSSIAN_5",
    "NOISY_GAUSSIAN_25",
]

THRESHOLD_MILES = [2, 5, 10, 15, 25]

N_TRIALS = int(sys.argv[1]) if len(sys.argv) > 1 else 500


def _run(args):
    name, mode, n = args
    from src.evaluator import evaluate
    return name, mode, evaluate(name, mode, n)


def _compute_threshold_stats(results: list, thresholds: list[float]) -> dict:
    """For each threshold, recompute failure_rate and mean from per-trial radius curves."""
    import numpy as np
    from src.simulation import GROUND_SEARCH_PENALTY_WEEKS, MAX_WEEKS

    threshold_stats = {}
    for t in thresholds:
        t_weeks = []
        t_failures = 0
        for r in results:
            localized_week = None
            for week, radius in enumerate(r.radius_by_week, start=1):
                if radius < t:
                    localized_week = week
                    break
            if localized_week is not None:
                t_weeks.append(localized_week + GROUND_SEARCH_PENALTY_WEEKS)
            else:
                t_weeks.append(MAX_WEEKS)
                t_failures += 1
        arr = np.array(t_weeks)
        threshold_stats[f"threshold_{t}"] = {
            "failure_rate": t_failures / len(results),
            "mean": float(np.mean(arr)),
            "median": float(np.median(arr)),
            "p90": float(np.percentile(arr, 90)),
        }
    return threshold_stats


def _run_with_raw(args):
    name, mode, n = args
    from src.evaluator import _build_registry
    from src.environment import Environment
    from src.simulation import run_trial
    import random
    import numpy as np
    random.seed(42)
    np.random.seed(42)
    strategy = _build_registry()[name]()
    env = Environment(mode)
    results = [run_trial(strategy, env) for _ in range(n)]
    return name, mode, results


def main():
    configs = [(name, mode, N_TRIALS) for mode in MODES for name in STRATEGIES]
    n_workers = min(len(configs), os.cpu_count() or 4)
    print(f"Running {len(configs)} configs x {N_TRIALS} trials ({n_workers} workers)...")

    from src.evaluator import evaluate

    raw = {}
    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        for name, mode, results in pool.map(_run_with_raw, configs):
            from src.evaluator import _build_registry
            import numpy as np

            weeks = np.array([r.weeks for r in results])
            failures = sum(1 for r in results if not r.localized)

            from src.simulation import MAX_WEEKS
            radius_matrix = np.full((len(results), MAX_WEEKS), np.nan)
            for i, r in enumerate(results):
                n = len(r.radius_by_week)
                radius_matrix[i, :n] = r.radius_by_week
                if n < MAX_WEEKS:
                    radius_matrix[i, n:] = r.radius_by_week[-1] if n > 0 else np.nan

            median_radius_curve = [
                float(np.nanmedian(radius_matrix[:, w])) for w in range(MAX_WEEKS)
            ]

            def _region(lat: float, lon: float) -> str:
                if lon < -104:
                    return "NW" if lat >= 40 else "SW"
                elif lon > -80:
                    return "NE" if lat >= 38 else "SE"
                return "CENTRAL"

            REGIONS = ["NW", "SW", "CENTRAL", "NE", "SE"]
            regional_stats = {}
            for region in REGIONS:
                rr = [r for r in results if _region(r.box_lat, r.box_lon) == region]
                if not rr:
                    regional_stats[region] = None
                    continue
                rw = np.array([r.weeks for r in rr])
                rf = sum(1 for r in rr if not r.localized)
                regional_stats[region] = {
                    "n_trials": len(rr),
                    "failure_rate": rf / len(rr),
                    "mean": float(np.mean(rw)),
                    "median": float(np.median(rw)),
                }

            threshold_stats = _compute_threshold_stats(results, THRESHOLD_MILES)

            raw[f"{name}|{mode}"] = {
                "n_trials": len(results),
                "mean": float(np.mean(weeks)),
                "median": float(np.median(weeks)),
                "p90": float(np.percentile(weeks, 90)),
                "p95": float(np.percentile(weeks, 95)),
                "p99": float(np.percentile(weeks, 99)),
                "max": int(np.max(weeks)),
                "failure_rate": failures / len(results),
                "median_radius_curve": median_radius_curve,
                "regional_stats": regional_stats,
                "threshold_stats": threshold_stats,
            }
            print(f"  done: {name} / {mode}", flush=True)

    out = Path(__file__).parent.parent / "data" / "results.json"
    with open(out, "w") as f:
        json.dump(raw, f, indent=2)
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
