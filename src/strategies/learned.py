"""Wraps a CEM-trained placement policy as a Strategy.

The policy was trained on ROUND_100_MILES via scripts/train_cem_policy.py.
Inference is a cheap forward pass through a tiny MLP and a snap to the
nearest CONUS candidate point (observers need to be valid locations).
"""
from __future__ import annotations

from pathlib import Path

import numpy as np

from ..environment import haversine_vec
from ..rl.env import MAX_DIST_MILES, MAX_RADIUS_MILES, _norm
from ..rl.policy import PARAM_DIM, forward
from ..simulation import MAX_WEEKS
from ..types import Point, SearchState
from .base import Strategy
from .candidates import get_candidates

LAT_MIN, LAT_MAX = 24.5, 49.5
LON_MIN, LON_MAX = -124.7, -66.9

_DEFAULT_POLICY = Path(__file__).parent.parent.parent / "data" / "learned_policy.npz"


class LearnedStrategy(Strategy):
    def __init__(self, policy_path: Path | None = None):
        path = policy_path or _DEFAULT_POLICY
        if not path.exists():
            raise FileNotFoundError(
                f"Learned policy not found at {path}. "
                "Run `python scripts/train_cem_policy.py` first."
            )
        data = np.load(path)
        self._theta = data["theta"].astype(np.float64)
        assert self._theta.shape == (PARAM_DIM,), \
            f"policy dim mismatch: file={self._theta.shape}, expected=({PARAM_DIM},)"
        self._candidates = get_candidates()
        self._cand_lats = np.array([p.lat for p in self._candidates])
        self._cand_lons = np.array([p.lon for p in self._candidates])

    def reset(self) -> None:
        pass

    def choose_location(self, state: SearchState) -> Point:
        obs = self._observation(state)
        action = forward(self._theta, obs)
        # Map [-1, 1]^2 action to CONUS bounding box, then snap to nearest
        # valid CONUS candidate point.
        lat = LAT_MIN + 0.5 * (action[0] + 1.0) * (LAT_MAX - LAT_MIN)
        lon = LON_MIN + 0.5 * (action[1] + 1.0) * (LON_MAX - LON_MIN)
        d = haversine_vec(float(lat), float(lon), self._cand_lats, self._cand_lons)
        return self._candidates[int(np.argmin(d))]

    def _observation(self, state: SearchState) -> np.ndarray:
        week = max(state.week, 1)
        belief = state.belief
        if belief is None:
            # Prior-only observation for week 1
            return np.array([
                week / MAX_WEEKS, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0
            ], dtype=np.float64)

        centroid = belief.best_estimate()
        radius = belief.uncertainty_radius()
        w = np.asarray(belief.weights).ravel()
        total = w.sum()
        if total <= 0:
            ent_norm = 1.0
        else:
            w = w / total
            nz = w[w > 1e-12]
            entropy = float(-np.sum(nz * np.log(nz))) if nz.size else 0.0
            n_cells = np.log(belief.weights.size)
            ent_norm = (entropy / n_cells) if n_cells > 0 else 0.0

        if state.measurements:
            last = state.measurements[-1]
            last_lat_n = _norm(last.location.lat, LAT_MIN, LAT_MAX)
            last_lon_n = _norm(last.location.lon, LON_MIN, LON_MAX)
            last_d_n = min(last.distance, MAX_DIST_MILES) / MAX_DIST_MILES
        else:
            last_lat_n = last_lon_n = last_d_n = 0.0

        return np.array([
            week / MAX_WEEKS,
            _norm(centroid.lat, LAT_MIN, LAT_MAX),
            _norm(centroid.lon, LON_MIN, LON_MAX),
            min(radius, MAX_RADIUS_MILES) / MAX_RADIUS_MILES,
            ent_norm,
            last_lat_n, last_lon_n, last_d_n,
        ], dtype=np.float64)
