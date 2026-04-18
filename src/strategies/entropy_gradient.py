import numpy as np

from ..environment import haversine_vec
from ..types import Point, SearchState
from .base import Strategy
from .candidates import get_candidates
from .max_separation import MaxSeparationStrategy


class EntropyGradientStrategy(Strategy):
    """
    Picks the measurement location that minimizes expected Shannon entropy of the
    posterior belief — a stricter information-theoretic criterion than the Herfindahl
    proxy used by InfoGainStrategy (which minimises Renyi entropy of order 2).

    Bucketing and distance computation are identical to InfoGainStrategy so the two
    strategies are directly comparable.
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
            score = self._expected_entropy(c, w, lats, lons, state.measurement_mode)
            if score < best_score:
                best_score, best = score, c
        return best

    def _expected_entropy(
        self,
        observer: Point,
        w: np.ndarray,
        lats: np.ndarray,
        lons: np.ndarray,
        mode: str,
    ) -> float:
        dists = haversine_vec(observer.lat, observer.lon, lats, lons)

        if mode == "EXACT":
            ids = np.round(dists / 2.0).astype(np.int32)
            ids -= ids.min()
            group_w = np.bincount(ids, weights=w)
        elif mode.startswith("ROUND_"):
            n = int(mode.split("_")[1])
            ids = np.round(dists / n).astype(np.int32)
            ids -= ids.min()
            group_w = np.bincount(ids, weights=w)
        elif mode in ("NOISY_GAUSSIAN_5", "NOISY_GAUSSIAN_25"):
            sigma = {"NOISY_GAUSSIAN_5": 5, "NOISY_GAUSSIAN_25": 25}[mode]
            mean_d = float(np.sum(w * dists))
            centers = np.linspace(max(0.0, mean_d - 3 * sigma), mean_d + 3 * sigma, 15)
            group_w = np.array([
                float((w * np.exp(-0.5 * ((dists - d) / sigma) ** 2)).sum())
                for d in centers
            ])
        else:
            return float("inf")

        total = group_w.sum()
        if total < 1e-10:
            return float("inf")
        group_p = group_w / total
        # Shannon entropy in nats — minimising this minimises expected posterior uncertainty
        return float(-np.sum(group_p * np.log(group_p + 1e-30)))
