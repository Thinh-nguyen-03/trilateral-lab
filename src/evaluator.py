import numpy as np
from concurrent.futures import ProcessPoolExecutor

from .environment import Environment
from .simulation import run_trial, TrialResult


def _build_registry():
    from .strategies.fixed import FixedStrategy
    from .strategies.random_strategy import RandomStrategy
    from .strategies.max_separation import MaxSeparationStrategy
    from .strategies.centroid import CentroidStrategy
    from .strategies.hybrid import HybridStrategy
    from .strategies.info_gain import InfoGainStrategy
    return {
        "fixed": FixedStrategy,
        "random": RandomStrategy,
        "max_separation": MaxSeparationStrategy,
        "centroid": CentroidStrategy,
        "hybrid": HybridStrategy,
        "info_gain": InfoGainStrategy,
    }


def _worker(args):
    """Top-level so it's picklable for multiprocessing."""
    strategy_name, strategy_kwargs, mode, n, seed = args
    import random
    import numpy as np
    random.seed(seed)
    np.random.seed(seed)
    strategy = _build_registry()[strategy_name](**strategy_kwargs)
    env = Environment(mode)
    return [run_trial(strategy, env) for _ in range(n)]


def evaluate(
    strategy_name: str,
    mode: str,
    n_trials: int,
    strategy_kwargs: dict = None,
    n_workers: int = 1,
) -> dict:
    strategy_kwargs = strategy_kwargs or {}

    if n_workers > 1:
        batch = max(1, n_trials // n_workers)
        args = [(strategy_name, strategy_kwargs, mode, batch, i) for i in range(n_workers)]
        results = []
        with ProcessPoolExecutor(max_workers=n_workers) as pool:
            for batch in pool.map(_worker, args):
                results.extend(batch)
        results = results[:n_trials]
    else:
        strategy = _build_registry()[strategy_name](**strategy_kwargs)
        env = Environment(mode)
        results = [run_trial(strategy, env) for _ in range(n_trials)]

    weeks = np.array([r.weeks for r in results])
    failures = sum(1 for r in results if not r.localized)

    return {
        "n_trials": len(results),
        "mean": float(np.mean(weeks)),
        "median": float(np.median(weeks)),
        "p90": float(np.percentile(weeks, 90)),
        "p95": float(np.percentile(weeks, 95)),
        "p99": float(np.percentile(weeks, 99)),
        "max": int(np.max(weeks)),
        "failure_rate": failures / len(results),
    }
