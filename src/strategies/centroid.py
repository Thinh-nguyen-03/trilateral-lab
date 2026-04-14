from ..environment import haversine
from ..types import Point, SearchState
from .base import Strategy
from .candidates import get_candidates

# Only enter centroid mode once the belief is reasonably concentrated.
# Below this radius, best_estimate is still near the prior mean (roughly Kansas)
# and measuring nearby adds no geometric diversity.
_FALLBACK_RADIUS_MILES = 200

# Require the centroid to have moved less than this between consecutive weeks
# before committing to centroid mode. If the centroid is still jumping around,
# the belief hasn't settled and measuring near it won't help.
_STABILITY_THRESHOLD_MILES = 50


class CentroidStrategy(Strategy):
    def __init__(self):
        self._prev_estimate: Point | None = None

    def reset(self) -> None:
        self._prev_estimate = None

    def choose_location(self, state: SearchState) -> Point:
        from .max_separation import MaxSeparationStrategy

        # Rounding modes produce multimodal beliefs (disconnected feasible arcs).
        # The centroid of a multimodal distribution falls between modes, so
        # measuring near it actively breaks convergence. Always use max_sep here.
        if state.measurement_mode.startswith("ROUND_"):
            return MaxSeparationStrategy().choose_location(state)

        prev = self._prev_estimate
        self._prev_estimate = state.best_estimate

        if state.best_estimate is None or state.uncertainty_radius > _FALLBACK_RADIUS_MILES:
            return MaxSeparationStrategy().choose_location(state)

        if prev is not None and haversine(state.best_estimate, prev) > _STABILITY_THRESHOLD_MILES:
            return MaxSeparationStrategy().choose_location(state)

        candidates = get_candidates()
        return min(candidates, key=lambda c: haversine(c, state.best_estimate))
