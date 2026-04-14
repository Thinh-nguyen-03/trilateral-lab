from ..types import Point, SearchState
from .base import Strategy
from .max_separation import MaxSeparationStrategy
from .centroid import CentroidStrategy

# Switch from max-separation to centroid once the belief is tight enough
# that best_estimate is a reliable measurement target.
_SWITCH_RADIUS_MILES = 100


class HybridStrategy(Strategy):
    def __init__(self, switch_radius_miles: float = _SWITCH_RADIUS_MILES):
        self.switch_radius = switch_radius_miles
        self._max_sep = MaxSeparationStrategy()
        self._centroid = CentroidStrategy()

    def reset(self) -> None:
        self._max_sep.reset()
        self._centroid.reset()

    def choose_location(self, state: SearchState) -> Point:
        if state.uncertainty_radius > self.switch_radius:
            return self._max_sep.choose_location(state)
        return self._centroid.choose_location(state)
