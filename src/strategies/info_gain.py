import numpy as np

from ..environment import haversine_vec
from ..types import Point, SearchState
from .base import Strategy
from .candidates import get_candidates
from .max_separation import MaxSeparationStrategy


class InfoGainStrategy(Strategy):
    """
    Picks the measurement location that minimizes expected surviving probability mass
    after the update — a proxy for expected posterior uncertainty.

    For rounding modes this equals sum_d P(d)^2 (Herfindahl index on outcomes),
    computed in O(n_cells) per candidate via bincount with no loop over outcomes.

    For Gaussian modes, discretizes into 15 buckets and sums squared group probabilities.

    Works with both GridBelief and ParticleFilter: both provide flat weight and
    coordinate arrays so the computation is identical.
    """

    def __init__(self, candidate_step: float = 3.0):
        self.candidate_step = candidate_step
        self._fallback = MaxSeparationStrategy()

    def choose_location(self, state: SearchState) -> Point:
        from ..belief.grid import GridBelief
        from ..belief.particle import ParticleFilter

        belief = state.belief
        if isinstance(belief, GridBelief):
            w = belief.weights.ravel()
            lats = belief.lat_grid.ravel()
            lons = belief.lon_grid.ravel()
        elif isinstance(belief, ParticleFilter):
            w = belief.weights
            lats = belief.lats
            lons = belief.lons
        else:
            return self._fallback.choose_location(state)

        candidates = get_candidates(step=self.candidate_step)
        best, best_score = None, float("inf")
        for c in candidates:
            score = self._herfindahl(c, w, lats, lons, state.measurement_mode)
            if score < best_score:
                best_score, best = score, c
        return best

    def _herfindahl(
        self,
        observer: Point,
        w: np.ndarray,
        lats: np.ndarray,
        lons: np.ndarray,
        mode: str,
    ) -> float:
        dists = haversine_vec(observer.lat, observer.lon, lats, lons)

        if mode == "EXACT":
            # Bucket by 2-mile intervals to match GridBelief's hard ring tolerance.
            # Using bincount is consistent with the hard-mask update and ~20x faster
            # than the 15-bucket exp loop used for Gaussian modes.
            ids = np.round(dists / 2.0).astype(np.int32)
            ids -= ids.min()
            group_w = np.bincount(ids, weights=w)
            return float(np.sum(group_w ** 2))

        elif mode.startswith("ROUND_"):
            n = int(mode.split("_")[1])
            ids = np.round(dists / n).astype(np.int32)
            ids -= ids.min()
            group_w = np.bincount(ids, weights=w)
            return float(np.sum(group_w ** 2))

        elif mode in ("NOISY_GAUSSIAN_5", "NOISY_GAUSSIAN_25"):
            sigma = {"NOISY_GAUSSIAN_5": 5, "NOISY_GAUSSIAN_25": 25}[mode]
            mean_d = float(np.sum(w * dists))
            centers = np.linspace(max(0.0, mean_d - 3 * sigma), mean_d + 3 * sigma, 15)
            group_p = np.array([
                float((w * np.exp(-0.5 * ((dists - d) / sigma) ** 2)).sum())
                for d in centers
            ])
            total = group_p.sum()
            if total < 1e-10:
                return float("inf")
            group_p /= total
            return float(np.sum(group_p ** 2))

        return float("inf")
