#!/usr/bin/env python
"""
Run the experiment matrix and print a results table.

Usage:
    python run.py                  # 100 trials, no info_gain
    python run.py 1000             # 1k trials
    python run.py 500 --all        # include info_gain (slow)
"""
import os
import sys
from concurrent.futures import ProcessPoolExecutor

STRATEGIES = ["fixed", "random", "max_separation", "centroid"]
STRATEGIES_ALL = STRATEGIES + ["info_gain"]
MODES = [
    "EXACT",
    "ROUND_10_MILES",
    "ROUND_25_MILES",
    "ROUND_100_MILES",
    "NOISY_GAUSSIAN_5",
    "NOISY_GAUSSIAN_25",
]

args = [a for a in sys.argv[1:] if not a.startswith("--")]
flags = [a for a in sys.argv[1:] if a.startswith("--")]

N_TRIALS = int(args[0]) if args else 100
strategies = STRATEGIES_ALL if "--all" in flags else STRATEGIES


def _run_config(cfg):
    name, mode, n_trials = cfg
    from src.evaluator import evaluate
    return name, mode, evaluate(name, mode, n_trials)


def main():
    col = f"{'strategy':<20} {'mode':<22} {'mean':>5} {'med':>4} {'p90':>4} {'p99':>4} {'fail%':>6}"
    print(col, flush=True)
    print("-" * len(col), flush=True)

    configs = [(name, mode, N_TRIALS) for mode in MODES for name in strategies]
    n_workers = min(len(configs), os.cpu_count() or 4)

    with ProcessPoolExecutor(max_workers=n_workers) as pool:
        futures = [pool.submit(_run_config, cfg) for cfg in configs]
        results = {}
        for future in futures:
            name, mode, s = future.result()
            results[(name, mode)] = s

    for mode in MODES:
        for name in strategies:
            s = results[(name, mode)]
            print(
                f"{name:<20} {mode:<22}"
                f" {s['mean']:5.1f} {s['median']:4.0f}"
                f" {s['p90']:4.0f} {s['p99']:4.0f}"
                f" {s['failure_rate']:6.1%}",
                flush=True,
            )
        print(flush=True)


if __name__ == "__main__":
    main()
