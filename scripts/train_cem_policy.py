#!/usr/bin/env python
"""Cross-Entropy Method (CEM) training for the placement policy.

CEM is a gradient-free optimiser that fits nicely here: the policy has only
~200 params, the fitness evaluation is cheap (run K trials, take mean reward),
and there are no gradients to worry about. Each generation we sample N policies
from a gaussian, evaluate them, keep the top elite fraction, and refit the
gaussian to the elites.

Trained on ROUND_100_MILES by default — that's the regime where info_gain
shows the largest gap vs CRLB, so there's the most room for a learned policy
to matter. The result is saved to data/learned_policy.npz along with a log
of per-generation mean elite fitness.
"""
import json
import os
import random
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.rl.env import PlacementEnv
from src.rl.policy import PARAM_DIM, forward


def _rollout(theta: np.ndarray, mode: str, seed: int) -> float:
    """Run a single episode; return total reward."""
    random.seed(seed)
    np.random.seed(seed)
    env = PlacementEnv(mode, seed=seed)
    obs = env.reset()
    total = 0.0
    done = False
    while not done:
        action = forward(theta, obs)
        obs, reward, done, _ = env.step(action)
        total += reward
    return total


def _evaluate(args):
    theta, mode, seeds = args
    return float(np.mean([_rollout(theta, mode, s) for s in seeds]))


def train(
    mode: str = "ROUND_100_MILES",
    generations: int = 30,
    pop_size: int = 24,
    elite_frac: float = 0.25,
    k_rollouts: int = 12,
    init_sigma: float = 0.8,
    sigma_decay: float = 0.97,
    seed: int = 42,
) -> tuple[np.ndarray, list[dict]]:
    rng = np.random.default_rng(seed)
    mean  = np.zeros(PARAM_DIM)
    sigma = init_sigma
    log: list[dict] = []

    n_elite = max(1, int(pop_size * elite_frac))
    n_workers = max(1, min(pop_size, (os.cpu_count() or 4) - 1))
    use_pool = pop_size >= 8  # Pool overhead dominates for small populations.

    pool = ProcessPoolExecutor(max_workers=n_workers) if use_pool else None
    try:
        for gen in range(generations):
            t0 = time.time()
            # Sample population around current mean
            pop = mean + rng.normal(size=(pop_size, PARAM_DIM)) * sigma
            seeds = rng.integers(0, 1_000_000, size=k_rollouts).tolist()

            jobs = [(pop[i], mode, seeds) for i in range(pop_size)]
            if pool is not None:
                fitness = list(pool.map(_evaluate, jobs, chunksize=1))
            else:
                fitness = [_evaluate(j) for j in jobs]
            fitness = np.asarray(fitness)

            elite_idx = np.argsort(-fitness)[:n_elite]
            elites = pop[elite_idx]
            mean = elites.mean(axis=0)
            sigma = max(0.05, sigma * sigma_decay)

            entry = {
                "gen": gen,
                "mean_fitness":  float(fitness.mean()),
                "elite_fitness": float(fitness[elite_idx].mean()),
                "best_fitness":  float(fitness.max()),
                "sigma":         float(sigma),
                "secs":          round(time.time() - t0, 1),
            }
            log.append(entry)
            print(
                f"gen {gen:3d}  pop_mean={entry['mean_fitness']:+7.2f}  "
                f"elite={entry['elite_fitness']:+7.2f}  best={entry['best_fitness']:+7.2f}  "
                f"sigma={sigma:.3f}  ({entry['secs']}s)",
                flush=True,
            )
    finally:
        if pool is not None:
            pool.shutdown()

    return mean, log


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "ROUND_100_MILES"
    generations = int(sys.argv[2]) if len(sys.argv) > 2 else 30

    print(f"Training CEM policy on {mode} for {generations} generations...")
    theta, log = train(mode=mode, generations=generations)

    dest = Path(__file__).parent.parent / "data" / "learned_policy.npz"
    np.savez(dest, theta=theta, mode=np.array(mode), generations=generations)
    print(f"Saved {dest}")

    log_dest = Path(__file__).parent.parent / "data" / "learned_policy_log.json"
    with open(log_dest, "w") as f:
        json.dump({"mode": mode, "generations": generations, "log": log}, f, indent=2)
    print(f"Saved {log_dest}")


if __name__ == "__main__":
    main()
