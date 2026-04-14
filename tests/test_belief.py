import pytest
from src.belief.grid import GridBelief
from src.types import Point


def test_update_reduces_feasible_region():
    belief = GridBelief("ROUND_10_MILES")
    before = (belief.weights > 0).sum()
    belief.update(Point(40.0, -100.0), 500.0)
    after = (belief.weights > 0).sum()
    assert after < before


def test_weights_sum_to_one():
    belief = GridBelief("ROUND_10_MILES")
    belief.update(Point(40.0, -100.0), 500.0)
    assert abs(belief.weights.sum() - 1.0) < 1e-6


def test_uncertainty_decreases_with_more_measurements():
    from src.environment import haversine
    # Use actual distances from a known box so measurements are geometrically consistent
    box = Point(39.0, -98.0)  # center of US
    observers = [
        Point(47.6, -122.3),  # Seattle
        Point(25.8, -80.2),   # Miami
        Point(41.8, -87.6),   # Chicago
    ]
    belief = GridBelief("ROUND_10_MILES")
    prev_r = float("inf")
    for obs in observers:
        d = round(haversine(obs, box) / 10) * 10
        belief.update(obs, d)
        r = belief.uncertainty_radius()
        assert r < prev_r
        prev_r = r


def test_update_never_expands_feasible_region():
    belief = GridBelief("ROUND_100_MILES")
    belief.update(Point(40.0, -100.0), 500.0)
    before = (belief.weights > 0).sum()
    belief.update(Point(35.0, -90.0), 800.0)
    after = (belief.weights > 0).sum()
    assert after <= before
