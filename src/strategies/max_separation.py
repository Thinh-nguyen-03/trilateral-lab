import numpy as np

from ..environment import haversine_vec
from ..types import Point, SearchState
from .base import Strategy
from .candidates import get_candidates

_candidate_arrays: dict[float, tuple[np.ndarray, np.ndarray, list[Point]]] = {}


def _get_candidate_arrays(step: float = 1.0):
    if step not in _candidate_arrays:
        pts = get_candidates(step)
        lats = np.array([p.lat for p in pts])
        lons = np.array([p.lon for p in pts])
        _candidate_arrays[step] = (lats, lons, pts)
    return _candidate_arrays[step]


class MaxSeparationStrategy(Strategy):
    def choose_location(self, state: SearchState) -> Point:
        lats, lons, pts = _get_candidate_arrays()
        previous = [m.location for m in state.measurements]

        if not previous:
            return Point(47.6, -122.3)  # Seattle

        min_dists = np.full(len(pts), np.inf)
        for prev in previous:
            d = haversine_vec(prev.lat, prev.lon, lats, lons)
            min_dists = np.minimum(min_dists, d)

        return pts[int(np.argmax(min_dists))]
