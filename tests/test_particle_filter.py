import numpy as np
import pytest
from src.belief.particle import ParticleFilter
from src.types import Point


def test_weights_sum_to_one():
    pf = ParticleFilter("ROUND_10_MILES", n_particles=500)
    pf.update(Point(40.0, -100.0), 500.0)
    assert abs(pf.weights.sum() - 1.0) < 1e-6


def test_update_shifts_mass_toward_correct_distance():
    pf = ParticleFilter("ROUND_10_MILES", n_particles=2000)
    observer = Point(40.0, -100.0)
    observed = 500.0
    pf.update(observer, observed)

    # Surviving particles should be roughly 500 miles from the observer
    from src.environment import haversine_vec
    dists = haversine_vec(observer.lat, observer.lon, pf.lats, pf.lons)
    weighted_mean_dist = float(np.sum(pf.weights * dists))
    assert abs(weighted_mean_dist - observed) < 50


def test_mass_concentrates_near_box_gaussian():
    # Gaussian mode is where the particle filter actually shines -- continuous
    # likelihood means all particles retain some weight and the distribution
    # narrows cleanly. Rounding modes produce binary likelihoods (10-mile rings)
    # that are too narrow for particles to land in reliably; use the grid belief
    # for rounding modes instead.
    from src.environment import haversine, haversine_vec
    box = Point(39.0, -98.0)
    observers = [Point(47.6, -122.3), Point(25.8, -80.2), Point(41.8, -87.6)]

    pf = ParticleFilter("NOISY_GAUSSIAN_5", n_particles=5000)

    dists_initial = haversine_vec(box.lat, box.lon, pf.lats, pf.lons)
    mass_initial = float(pf.weights[dists_initial < 500].sum())

    for obs in observers:
        d = haversine(obs, box)
        pf.update(obs, d)

    dists_final = haversine_vec(box.lat, box.lon, pf.lats, pf.lons)
    mass_final = float(pf.weights[dists_final < 500].sum())

    assert mass_final > mass_initial * 3, (
        f"mass near box should grow substantially: {mass_initial:.3f} -> {mass_final:.3f}"
    )


def test_best_estimate_approaches_box():
    np.random.seed(42)
    from src.environment import haversine
    box = Point(39.0, -98.0)
    observers = [Point(47.6, -122.3), Point(25.8, -80.2), Point(41.8, -87.6)]

    pf = ParticleFilter("ROUND_10_MILES", n_particles=5000)
    for obs in observers:
        d = round(haversine(obs, box) / 10) * 10
        pf.update(obs, d)

    est = pf.best_estimate()
    dist_to_box = haversine(est, box)
    assert dist_to_box < 200, f"estimate {dist_to_box:.0f} miles from box after 3 measurements"


def test_gaussian_mode():
    pf = ParticleFilter("NOISY_GAUSSIAN_5", n_particles=1000)
    pf.update(Point(40.0, -100.0), 500.0)
    assert abs(pf.weights.sum() - 1.0) < 1e-6
    assert pf.uncertainty_radius() < float("inf")
