#!/usr/bin/env python
"""
Run trials per (strategy, mode), collect the box locations of every timed-out
trial, and cluster them geographically with KMeans. Writes the cluster polygons
(convex hulls) and per-strategy/mode breakdown to data/failure_clusters.json.

Usage:
    python scripts/cluster_failures.py            # 500 trials per config
    python scripts/cluster_failures.py 1000       # custom trial count
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

N_TRIALS = int(sys.argv[1]) if len(sys.argv) > 1 else 500
N_CLUSTERS = 6
MIN_FAILURES_FOR_CLUSTER = 12


def _run(args):
    name, mode, n = args
    import random
    import numpy as np
    from src.evaluator import _build_registry
    from src.environment import Environment
    from src.simulation import run_trial

    random.seed(42)
    np.random.seed(42)
    strategy = _build_registry()[name]()
    env = Environment(mode)
    failures = []
    for _ in range(n):
        r = run_trial(strategy, env)
        if not r.localized:
            failures.append((r.box_lat, r.box_lon))
    return name, mode, failures


def _cluster(failures: list[tuple[float, float]]) -> list[dict]:
    """Returns a list of {centroid_lat, centroid_lon, count, hull: [[lon, lat], ...]}.

    Skips clustering if too few failures; in that case returns one "cluster" per
    point (no hull). Falls back to the whole point set if KMeans would degenerate.
    """
    import numpy as np
    from sklearn.cluster import KMeans

    if not failures:
        return []

    coords = np.array(failures, dtype=float)  # columns: lat, lon
    n = coords.shape[0]
    k = min(N_CLUSTERS, max(1, n // 4))

    if n < MIN_FAILURES_FOR_CLUSTER or k <= 1:
        return [{
            "centroid_lat": float(coords[:, 0].mean()),
            "centroid_lon": float(coords[:, 1].mean()),
            "count": int(n),
            "hull": _hull_polygon(coords),
        }]

    km = KMeans(n_clusters=k, n_init=10, random_state=0).fit(coords)
    labels = km.labels_
    out = []
    for i in range(k):
        mask = labels == i
        pts = coords[mask]
        if pts.shape[0] == 0:
            continue
        out.append({
            "centroid_lat": float(km.cluster_centers_[i, 0]),
            "centroid_lon": float(km.cluster_centers_[i, 1]),
            "count": int(pts.shape[0]),
            "hull": _hull_polygon(pts),
        })

    out.sort(key=lambda c: -c["count"])
    return out


def _hull_polygon(coords) -> list[list[float]]:
    """Returns [[lon, lat], ...] (closed) for the convex hull of `coords` (lat, lon).
    Falls back to the input points if the hull is degenerate (all collinear / <3 pts).
    """
    import numpy as np
    from scipy.spatial import ConvexHull, QhullError

    if coords.shape[0] < 3:
        return [[float(c[1]), float(c[0])] for c in coords]
    try:
        hull = ConvexHull(coords[:, ::-1])  # ConvexHull on (lon, lat)
        ring = [
            [float(coords[i, 1]), float(coords[i, 0])]
            for i in hull.vertices
        ]
        ring.append(ring[0])
        return ring
    except QhullError:
        return [[float(c[1]), float(c[0])] for c in coords]


def main():
    configs = [(name, mode, N_TRIALS) for mode in MODES for name in STRATEGIES]
    n_workers = min(len(configs), os.cpu_count() or 4)
    print(f"Running {len(configs)} configs x {N_TRIALS} trials ({n_workers} workers)...")

    cells: dict[str, dict] = {}
    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        for name, mode, failures in pool.map(_run, configs):
            clusters = _cluster(failures)
            cells[f"{name}|{mode}"] = {
                "n_failures": len(failures),
                "clusters": clusters,
            }
            print(f"  done: {name} / {mode}  ({len(failures)} failures, {len(clusters)} clusters)", flush=True)

    out = {
        "n_trials_per_config": N_TRIALS,
        "n_clusters": N_CLUSTERS,
        "strategies": STRATEGIES,
        "modes": MODES,
        "cells": cells,
    }
    path = Path(__file__).parent.parent / "data" / "failure_clusters.json"
    with open(path, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Saved {path}")


if __name__ == "__main__":
    main()
