"""Lightweight gym-style environment for the placement policy.

Wraps the existing Environment + GridBelief/ParticleFilter pipeline and
exposes:
    obs, info  = env.reset(box=None)
    obs, reward, done, info = env.step(action)

Observation (OBS_DIM = 8), all scaled to roughly [-1, 1]:
    [ week_norm,
      centroid_lat_n, centroid_lon_n,
      radius_norm,
      entropy_norm,
      last_obs_lat_n, last_obs_lon_n, last_dist_norm ]

Action: 2-vector in [-1, 1], mapped to the CONUS lat/lon bounding box.
Reward: -1 per week, +100 on localisation, -10 at MAX_WEEKS timeout.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from ..belief.grid import GridBelief, LAT_MAX, LAT_MIN, LON_MAX, LON_MIN
from ..belief.particle import ParticleFilter
from ..environment import Environment
from ..simulation import (
    GROUND_SEARCH_PENALTY_WEEKS,
    LOCALIZATION_THRESHOLD_MILES,
    MAX_WEEKS,
    _GAUSSIAN_MODES,
)
from ..types import Measurement, Point, SearchState

MAX_DIST_MILES = 3500.0
MAX_RADIUS_MILES = 2000.0


@dataclass
class StepInfo:
    localized:   bool
    radius:      float
    week:        int
    last_action: tuple[float, float]


class PlacementEnv:
    def __init__(self, measurement_mode: str, seed: int | None = None):
        self.measurement_mode = measurement_mode
        self._rng = np.random.default_rng(seed)

    def reset(self, box: Point | None = None) -> np.ndarray:
        self.env = Environment(self.measurement_mode)
        if box is None:
            self.box = self.env.sample_box_location()
        else:
            self.box = box
        if self.measurement_mode in _GAUSSIAN_MODES:
            self.belief = ParticleFilter(self.measurement_mode)
        else:
            self.belief = GridBelief(self.measurement_mode)
        self.week = 0
        self.state = SearchState(
            week=0, measurement_mode=self.measurement_mode, measurements=[]
        )
        self._last_obs = (0.0, 0.0)
        self._last_dist = 0.0
        self._n_log_cells = math.log(self.belief.weights.size)
        return self._observation()

    def step(self, action: np.ndarray) -> tuple[np.ndarray, float, bool, StepInfo]:
        # Map action in [-1, 1]^2 to CONUS lat/lon
        a = np.clip(action, -1.0, 1.0)
        lat = LAT_MIN + 0.5 * (a[0] + 1.0) * (LAT_MAX - LAT_MIN)
        lon = LON_MIN + 0.5 * (a[1] + 1.0) * (LON_MAX - LON_MIN)
        obs_point = Point(float(lat), float(lon))

        self.week += 1
        self.state.week = self.week

        distance = self.env.measure_distance(obs_point, self.box)
        self.belief.update(obs_point, distance)
        self.state.measurements.append(Measurement(obs_point, distance))

        radius = self.belief.uncertainty_radius()
        self.state.uncertainty_radius = radius
        self._last_obs = (obs_point.lat, obs_point.lon)
        self._last_dist = distance

        reward = -1.0
        done = False
        if radius < LOCALIZATION_THRESHOLD_MILES:
            reward += 100.0 - GROUND_SEARCH_PENALTY_WEEKS
            done = True
        elif self.week >= MAX_WEEKS:
            reward -= 10.0
            done = True

        return self._observation(), reward, done, StepInfo(
            localized=(radius < LOCALIZATION_THRESHOLD_MILES),
            radius=radius,
            week=self.week,
            last_action=(obs_point.lat, obs_point.lon),
        )

    def _observation(self) -> np.ndarray:
        centroid = self.belief.best_estimate()
        radius = self.belief.uncertainty_radius()

        # Entropy of the belief (only meaningful for GridBelief; for particles
        # we use log of effective sample size).
        w = np.asarray(self.belief.weights).ravel()
        total = w.sum()
        if total <= 0:
            ent_norm = 1.0
        else:
            w = w / total
            nz = w[w > 1e-12]
            entropy = float(-np.sum(nz * np.log(nz))) if nz.size else 0.0
            ent_norm = entropy / self._n_log_cells if self._n_log_cells > 0 else 0.0

        return np.array([
            self.week / MAX_WEEKS,
            _norm(centroid.lat, LAT_MIN, LAT_MAX),
            _norm(centroid.lon, LON_MIN, LON_MAX),
            min(radius, MAX_RADIUS_MILES) / MAX_RADIUS_MILES,
            ent_norm,
            _norm(self._last_obs[0], LAT_MIN, LAT_MAX) if self.week else 0.0,
            _norm(self._last_obs[1], LON_MIN, LON_MAX) if self.week else 0.0,
            min(self._last_dist, MAX_DIST_MILES) / MAX_DIST_MILES,
        ], dtype=np.float64)


def _norm(v: float, lo: float, hi: float) -> float:
    """Scale v from [lo, hi] to [-1, 1]."""
    return 2.0 * (v - lo) / (hi - lo) - 1.0
