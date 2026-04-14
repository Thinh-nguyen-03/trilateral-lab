import numpy as np

from ..environment import haversine_vec, EARTH_RADIUS_MILES
from ..types import Point
from .base import Belief

LAT_MIN, LAT_MAX = 24.5, 49.5
LON_MIN, LON_MAX = -124.7, -66.9
GRID_STEP = 0.1


class GridBelief(Belief):
    def __init__(self, measurement_mode: str):
        self.measurement_mode = measurement_mode

        lats = np.arange(LAT_MIN, LAT_MAX, GRID_STEP)
        lons = np.arange(LON_MIN, LON_MAX, GRID_STEP)
        self.lon_grid, self.lat_grid = np.meshgrid(lons, lats)
        self.shape = self.lat_grid.shape

        # Uniform initial weights
        self.weights = np.ones(self.shape, dtype=np.float64)
        self.weights /= self.weights.sum()

    def update(self, observer: Point, observed_distance: float) -> None:
        dists = haversine_vec(observer.lat, observer.lon, self.lat_grid, self.lon_grid)
        mode = self.measurement_mode

        if mode == "EXACT":
            # Half a grid cell in miles, approximate
            cell_width = GRID_STEP * 69.0 * 0.5
            mask = np.abs(dists - observed_distance) <= cell_width
            self.weights *= mask
        elif mode.startswith("ROUND_"):
            n = int(mode.split("_")[1])
            rounded = np.round(dists / n) * n
            mask = np.abs(rounded - observed_distance) < 1e-6
            self.weights *= mask
        elif mode == "NOISY_GAUSSIAN_5":
            self.weights *= np.exp(-0.5 * ((dists - observed_distance) / 5) ** 2)
        elif mode == "NOISY_GAUSSIAN_25":
            self.weights *= np.exp(-0.5 * ((dists - observed_distance) / 25) ** 2)
        else:
            raise ValueError(f"Unknown measurement mode: {mode}")

        total = self.weights.sum()
        if total == 0:
            # All cells eliminated; reset to uniform
            self.weights = np.ones(self.shape, dtype=np.float64)
            total = self.weights.sum()
        self.weights /= total

    def best_estimate(self) -> Point:
        lat = float(np.sum(self.weights * self.lat_grid))
        lon = float(np.sum(self.weights * self.lon_grid))
        return Point(lat, lon)

    def uncertainty_radius(self) -> float:
        centroid = self.best_estimate()
        dists = haversine_vec(centroid.lat, centroid.lon, self.lat_grid, self.lon_grid)

        flat_weights = self.weights.ravel()
        flat_dists = dists.ravel()

        order = np.argsort(flat_dists)
        cumsum = np.cumsum(flat_weights[order])
        idx = np.searchsorted(cumsum, 0.95)
        return float(flat_dists[order[idx]])
