import pytest
from src.environment import haversine
from src.types import Point


def test_haversine_known_distance():
    # New York to Los Angeles is roughly 2445 miles
    ny = Point(40.7128, -74.0060)
    la = Point(34.0522, -118.2437)
    assert abs(haversine(ny, la) - 2445) < 20


def test_haversine_zero():
    p = Point(39.0, -98.0)
    assert haversine(p, p) == 0.0


def test_haversine_symmetry():
    a = Point(35.0, -90.0)
    b = Point(45.0, -110.0)
    assert abs(haversine(a, b) - haversine(b, a)) < 1e-6
