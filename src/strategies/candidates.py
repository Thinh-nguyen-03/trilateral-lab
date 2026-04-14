"""
Pre-sampled grid of candidate measurement points covering the continental US.
Strategies that need to enumerate options (max-separation, info-gain) use this.
"""
import numpy as np
from ..environment import _in_continental_us
from ..types import Point

_cache: dict[float, list[Point]] = {}


def get_candidates(step: float = 1.0) -> list[Point]:
    """Returns a grid of points inside the continental US at the given degree spacing."""
    if step in _cache:
        return _cache[step]

    lats = np.arange(24.5, 49.5, step)
    lons = np.arange(-124.7, -66.9, step)
    points = []
    for lat in lats:
        for lon in lons:
            if _in_continental_us(float(lat), float(lon)):
                points.append(Point(float(lat), float(lon)))
    _cache[step] = points
    return points
