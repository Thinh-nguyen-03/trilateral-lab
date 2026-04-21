from ..types import Point, SearchState
from .base import Strategy

SEQUENCE = [
    Point(47.6, -122.3),   # Seattle
    Point(25.8, -80.2),    # Miami
    Point(41.8, -87.6),    # Chicago
    Point(34.0, -118.2),   # Los Angeles
    Point(32.8, -96.8),    # Dallas
    Point(42.4, -71.1),    # Boston
    Point(29.8, -95.4),    # Houston
    Point(39.9, -105.0),   # Denver
    Point(33.4, -112.1),   # Phoenix
    Point(44.9, -93.2),    # Minneapolis
]


class FixedStrategy(Strategy):
    def choose_location(self, state: SearchState) -> Point:
        idx = (state.week - 1) % len(SEQUENCE)
        return SEQUENCE[idx]
