import numpy as np

from ..environment import haversine_vec
from ..types import Point
from .base import Belief

LAT_MIN, LAT_MAX = 24.5, 49.5
LON_MIN, LON_MAX = -124.7, -66.9


class ParticleFilter(Belief):
    def __init__(self, measurement_mode: str, n_particles: int = 10000):
        self.measurement_mode = measurement_mode
        self.n = n_particles
        self.lats = np.random.uniform(LAT_MIN, LAT_MAX, n_particles)
        self.lons = np.random.uniform(LON_MIN, LON_MAX, n_particles)
        self.weights = np.ones(n_particles) / n_particles

    def update(self, observer: Point, observed_distance: float) -> None:
        dists = haversine_vec(observer.lat, observer.lon, self.lats, self.lons)
        self.weights *= self._likelihood(dists, observed_distance)

        total = self.weights.sum()
        if total == 0:
            self.lats = np.random.uniform(LAT_MIN, LAT_MAX, self.n)
            self.lons = np.random.uniform(LON_MIN, LON_MAX, self.n)
            self.weights = np.ones(self.n) / self.n
            return

        self.weights /= total

        n_eff = 1.0 / np.sum(self.weights ** 2)
        if n_eff < self.n / 2:
            self._resample()

    def _likelihood(self, dists: np.ndarray, observed: float) -> np.ndarray:
        mode = self.measurement_mode
        if mode == "EXACT":
            return (np.abs(dists - observed) < 2.0).astype(float)
        elif mode.startswith("ROUND_"):
            n = int(mode.split("_")[1])
            return (np.abs(np.round(dists / n) * n - observed) < 1e-6).astype(float)
        elif mode == "NOISY_GAUSSIAN_5":
            return np.exp(-0.5 * ((dists - observed) / 5) ** 2)
        elif mode == "NOISY_GAUSSIAN_25":
            return np.exp(-0.5 * ((dists - observed) / 25) ** 2)
        raise ValueError(f"Unknown mode: {mode}")

    def _resample(self) -> None:
        cumsum = np.cumsum(self.weights)
        u = (np.arange(self.n) + np.random.uniform()) / self.n
        indices = np.searchsorted(cumsum, u)
        self.lats = self.lats[indices]
        self.lons = self.lons[indices]
        self.weights = np.ones(self.n) / self.n

    def best_estimate(self) -> Point:
        return Point(
            float(np.sum(self.weights * self.lats)),
            float(np.sum(self.weights * self.lons)),
        )

    def uncertainty_radius(self) -> float:
        est = self.best_estimate()
        dists = haversine_vec(est.lat, est.lon, self.lats, self.lons)
        order = np.argsort(dists)
        cumsum = np.cumsum(self.weights[order])
        idx = np.searchsorted(cumsum, 0.95)
        return float(dists[order[min(idx, self.n - 1)]])

    def covariance_ellipse(self):
        from .grid import _ellipse_from_weighted_points
        return _ellipse_from_weighted_points(self.lats, self.lons, self.weights)
