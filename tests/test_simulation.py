import pytest
from src.simulation import run_trial, LOCALIZATION_THRESHOLD_MILES
from src.environment import Environment
from src.strategies.max_separation import MaxSeparationStrategy


def test_trial_returns_result():
    env = Environment("ROUND_10_MILES")
    strategy = MaxSeparationStrategy()
    result = run_trial(strategy, env)
    assert result.weeks >= 1
    assert isinstance(result.localized, bool)


def test_localized_result_has_penalty():
    # If a trial localizes, weeks should include the 2-week ground search penalty
    from src.simulation import GROUND_SEARCH_PENALTY_WEEKS
    env = Environment("EXACT")
    strategy = MaxSeparationStrategy()
    # Run enough trials that at least one localizes
    for _ in range(20):
        result = run_trial(strategy, env)
        if result.localized:
            assert result.weeks >= GROUND_SEARCH_PENALTY_WEEKS + 1
            return
