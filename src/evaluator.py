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
    from .strategies.entropy_gradient import EntropyGradientStrategy
    from .strategies.learned import LearnedStrategy
    from .strategies.manual import ManualStrategy
    return {
        "fixed": FixedStrategy,
        "random": RandomStrategy,
        "max_separation": MaxSeparationStrategy,
        "centroid": CentroidStrategy,
        "hybrid": HybridStrategy,
        "info_gain": InfoGainStrategy,
        "entropy_gradient": EntropyGradientStrategy,
        "learned": LearnedStrategy,
        "manual": ManualStrategy,
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

    def _region(lat: float, lon: float) -> str:
        if lon < -104:
            return "NW" if lat >= 40 else "SW"
        elif lon > -80:
            return "NE" if lat >= 38 else "SE"
        return "CENTRAL"
    failures = sum(1 for r in results if not r.localized)

    # Build (n_trials, MAX_WEEKS) matrix — pad short trials with their last radius
    from .simulation import MAX_WEEKS
    radius_matrix = np.full((len(results), MAX_WEEKS), np.nan)
    for i, r in enumerate(results):
        n = len(r.radius_by_week)
        radius_matrix[i, :n] = r.radius_by_week
        if n < MAX_WEEKS:
            radius_matrix[i, n:] = r.radius_by_week[-1] if n > 0 else np.nan

    median_radius_curve = [
        float(np.nanmedian(radius_matrix[:, w])) for w in range(MAX_WEEKS)
    ]

    REGIONS = ["NW", "SW", "CENTRAL", "NE", "SE"]
    regional_stats = {}
    for region in REGIONS:
        region_results = [r for r in results if _region(r.box_lat, r.box_lon) == region]
        if not region_results:
            regional_stats[region] = None
            continue
        rw = np.array([r.weeks for r in region_results])
        rf = sum(1 for r in region_results if not r.localized)
        regional_stats[region] = {
            "n_trials": len(region_results),
            "failure_rate": rf / len(region_results),
            "mean": float(np.mean(rw)),
            "median": float(np.median(rw)),
        }

    return {
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
    }
