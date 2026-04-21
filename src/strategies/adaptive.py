from ..types import Point, SearchState
from .base import Strategy
from .max_separation import MaxSeparationStrategy
from .centroid import CentroidStrategy

_DEFAULT_THRESHOLD_MILES = 50.0


class AdaptiveStrategy(Strategy):
    def __init__(self, threshold_miles: float = _DEFAULT_THRESHOLD_MILES):
        self.threshold_miles = float(threshold_miles)
        self._exploration = MaxSeparationStrategy()
        self._exploitation = CentroidStrategy()

    def reset(self) -> None:
        self._exploration.reset()
        self._exploitation.reset()

    def choose_location(self, state: SearchState) -> Point:
        if state.uncertainty_radius > self.threshold_miles:
            return self._exploration.choose_location(state)
        return self._exploitation.choose_location(state)
