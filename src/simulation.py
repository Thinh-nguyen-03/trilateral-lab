from dataclasses import dataclass

from .belief.grid import GridBelief
from .belief.particle import ParticleFilter
from .environment import Environment
from .strategies.base import Strategy
from .types import Measurement, SearchState

LOCALIZATION_THRESHOLD_MILES = 5
GROUND_SEARCH_PENALTY_WEEKS = 2
MAX_WEEKS = 52

_GAUSSIAN_MODES = {"NOISY_GAUSSIAN_5", "NOISY_GAUSSIAN_25"}


@dataclass
class TrialResult:
    localized: bool
    weeks: int  # includes ground search penalty if localized


def run_trial(strategy: Strategy, env: Environment) -> TrialResult:
    strategy.reset()
    box = env.sample_box_location()

    if env.measurement_mode in _GAUSSIAN_MODES:
        belief = ParticleFilter(env.measurement_mode)
    else:
        belief = GridBelief(env.measurement_mode)

    state = SearchState(
        week=0,
        measurement_mode=env.measurement_mode,
        measurements=[],
        uncertainty_radius=float("inf"),
        best_estimate=None,
    )

    for week in range(1, MAX_WEEKS + 1):
        state.week = week
        location = strategy.choose_location(state)
        distance = env.measure_distance(location, box)

        belief.update(location, distance)
        state.measurements.append(Measurement(location, distance))
        state.uncertainty_radius = belief.uncertainty_radius()
        state.best_estimate = belief.best_estimate()
        state.belief = belief

        if state.uncertainty_radius < LOCALIZATION_THRESHOLD_MILES:
            return TrialResult(localized=True, weeks=week + GROUND_SEARCH_PENALTY_WEEKS)

    return TrialResult(localized=False, weeks=MAX_WEEKS)
