#!/usr/bin/env python
"""
Run info_gain across all modes and merge results into data/results.json.
NOISY_GAUSSIAN_25 is hardcoded from a prior 25-trial run (particle filter +
candidate loop is ~5s/trial, making 100 trials take ~9 minutes for that mode alone).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from src.evaluator import evaluate

MODES = [
    "EXACT",
    "ROUND_10_MILES",
    "ROUND_25_MILES",
    "ROUND_100_MILES",
    "NOISY_GAUSSIAN_5",
]

results_file = Path(__file__).parent.parent / "data" / "results.json"
with open(results_file) as f:
    raw = json.load(f)

for mode in MODES:
    print(f"Running info_gain / {mode} (100 trials)...", flush=True)
    s = evaluate("info_gain", mode, 100)
    raw[f"info_gain|{mode}"] = s
    print(f"  mean={s['mean']:.1f}  fail={s['failure_rate']:.1%}", flush=True)

# NOISY_GAUSSIAN_25: use 25-trial result from earlier run (too slow to re-run routinely)
print("Using prior 25-trial result for NOISY_GAUSSIAN_25...", flush=True)
raw["info_gain|NOISY_GAUSSIAN_25"] = evaluate("info_gain", "NOISY_GAUSSIAN_25", 25)
s = raw["info_gain|NOISY_GAUSSIAN_25"]
print(f"  mean={s['mean']:.1f}  fail={s['failure_rate']:.1%}", flush=True)

with open(results_file, "w") as f:
    json.dump(raw, f, indent=2)
print(f"Saved {results_file} ({len(raw)} configs)")
