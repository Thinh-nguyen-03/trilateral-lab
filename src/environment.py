import json
import math
import random
from pathlib import Path

import numpy as np

from .types import Point

EARTH_RADIUS_MILES = 3958.8

_boundary = None


def _load_boundary():
    global _boundary
    if _boundary is None:
        path = Path(__file__).parent.parent / "data" / "us_boundary.geojson"
        if not path.exists():
            return None
        with open(path) as f:
            _boundary = json.load(f)
    return _boundary


def haversine(a: Point, b: Point) -> float:
    lat1, lon1 = math.radians(a.lat), math.radians(a.lon)
    lat2, lon2 = math.radians(b.lat), math.radians(b.lon)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def haversine_vec(lat1: float, lon1: float, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
    """Vectorized haversine from a single point to an array of points."""
    lat1, lon1 = math.radians(lat1), math.radians(lon1)
    lats = np.radians(lats)
    lons = np.radians(lons)
    dlat = lats - lat1
    dlon = lons - lon1
    h = np.sin(dlat / 2) ** 2 + math.cos(lat1) * np.cos(lats) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * np.arcsin(np.sqrt(h))


def _point_in_polygon(lat: float, lon: float, polygon: list) -> bool:
    """Ray casting point-in-polygon check."""
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i][0], polygon[i][1]
        xj, yj = polygon[j][0], polygon[j][1]
        if ((yi > lat) != (yj > lat)) and (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def _in_continental_us(lat: float, lon: float) -> bool:
    geo = _load_boundary()
    if geo is None:
        # Bounding box fallback when GeoJSON isn't present, includes some ocean cells
        return 24.5 <= lat <= 49.5 and -124.7 <= lon <= -66.9
    for feature in geo["features"]:
        geom = feature["geometry"]
        coords = geom["coordinates"]
        if geom["type"] == "Polygon":
            if _point_in_polygon(lat, lon, coords[0]):
                return True
        elif geom["type"] == "MultiPolygon":
            for poly in coords:
                if _point_in_polygon(lat, lon, poly[0]):
                    return True
    return False


def sample_box_location() -> Point:
    # Bounding box for continental US
    lat_min, lat_max = 24.5, 49.5
    lon_min, lon_max = -124.7, -66.9
    while True:
        lat = random.uniform(lat_min, lat_max)
        lon = random.uniform(lon_min, lon_max)
        if _in_continental_us(lat, lon):
            return Point(lat, lon)


class Environment:
    def __init__(self, measurement_mode: str):
        self.measurement_mode = measurement_mode

    def sample_box_location(self) -> Point:
        return sample_box_location()

    def measure_distance(self, observer: Point, box: Point) -> float:
        d = haversine(observer, box)
        mode = self.measurement_mode
        if mode == "EXACT":
            return d
        elif mode == "ROUND_10_MILES":
            return round(d / 10) * 10
        elif mode == "ROUND_25_MILES":
            return round(d / 25) * 25
        elif mode == "ROUND_100_MILES":
            return round(d / 100) * 100
        elif mode == "NOISY_GAUSSIAN_5":
            return d + random.gauss(0, 5)
        elif mode == "NOISY_GAUSSIAN_25":
            return d + random.gauss(0, 25)
        else:
            raise ValueError(f"Unknown measurement mode: {mode}")
