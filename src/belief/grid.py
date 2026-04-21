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

        self.weights = np.ones(self.shape, dtype=np.float64)
        self.weights /= self.weights.sum()

    def update(self, observer: Point, observed_distance: float) -> None:
        dists = haversine_vec(observer.lat, observer.lon, self.lat_grid, self.lon_grid)
        mode = self.measurement_mode

        if mode == "EXACT":
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

    def covariance_ellipse(self):
        return _ellipse_from_weighted_points(
            self.lat_grid.ravel(), self.lon_grid.ravel(), self.weights.ravel()
        )


def _ellipse_from_weighted_points(lats: np.ndarray, lons: np.ndarray, weights: np.ndarray):
    total = float(weights.sum())
    if total <= 0:
        return None
    w = weights / total
    mu_lat = float(np.dot(w, lats))
    mu_lon = float(np.dot(w, lons))

    cos_lat = np.cos(np.radians(mu_lat))
    y = (lats - mu_lat) * 69.0
    x = (lons - mu_lon) * 69.0 * cos_lat

    cov = np.array([
        [float(np.sum(w * x * x)), float(np.sum(w * x * y))],
        [float(np.sum(w * x * y)), float(np.sum(w * y * y))],
    ])
    eig_vals, eig_vecs = np.linalg.eigh(cov)
    eig_vals = np.clip(eig_vals, 0.0, None)

    # 95% confidence: chi-square scaling for 2 dof
    chi2_scale = 2.4477
    semi_major = float(np.sqrt(eig_vals[1]) * chi2_scale)
    semi_minor = float(np.sqrt(eig_vals[0]) * chi2_scale)

    major_vec = eig_vecs[:, 1]
    angle_deg = float(np.degrees(np.arctan2(major_vec[1], major_vec[0])))

    if not np.isfinite(semi_major) or not np.isfinite(semi_minor):
        return None
    return mu_lat, mu_lon, semi_major, semi_minor, angle_deg
