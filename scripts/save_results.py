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

N_TRIALS = int(sys.argv[1]) if len(sys.argv) > 1 else 500


def _run(args):
    name, mode, n = args
    from src.evaluator import evaluate
    return name, mode, evaluate(name, mode, n)


def main():
    configs = [(name, mode, N_TRIALS) for mode in MODES for name in STRATEGIES]
    n_workers = min(len(configs), os.cpu_count() or 4)
    print(f"Running {len(configs)} configs × {N_TRIALS} trials ({n_workers} workers)...")

    raw = {}
    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        for name, mode, s in pool.map(_run, configs):
            raw[f"{name}|{mode}"] = s
            print(f"  done: {name} / {mode}", flush=True)

    out = Path(__file__).parent.parent / "data" / "results.json"
    with open(out, "w") as f:
        json.dump(raw, f, indent=2)
    print(f"Saved {out}")


if __name__ == "__main__":
    main()
