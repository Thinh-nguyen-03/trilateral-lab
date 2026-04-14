import pytest
from src.strategies.fixed import FixedStrategy
from src.strategies.random_strategy import RandomStrategy
from src.strategies.max_separation import MaxSeparationStrategy
from src.types import SearchState


def make_state(week=1):
    return SearchState(week=week, measurement_mode="EXACT")


def test_fixed_is_deterministic():
    s = FixedStrategy()
    state = make_state(week=1)
    assert s.choose_location(state) == s.choose_location(state)


def test_fixed_cycles():
    s = FixedStrategy()
    loc1 = s.choose_location(make_state(week=1))
    loc2 = s.choose_location(make_state(week=2))
    assert loc1 != loc2


def test_random_returns_point():
    s = RandomStrategy()
    loc = s.choose_location(make_state())
    assert loc.lat is not None
    assert loc.lon is not None


def test_max_separation_first_week():
    s = MaxSeparationStrategy()
    loc = s.choose_location(make_state(week=1))
    assert loc is not None
