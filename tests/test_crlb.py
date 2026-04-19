"""Tests for the CRLB computation. The point of CRLB is a diagnostic lower
bound — these tests verify the bound behaves the way information theory says
it should in limiting regimes, not that it matches any specific number."""
from scripts.crlb import (
    MODE_VARIANCE_MI2,
    _max_sep_observer_sequence,
    _trace_sqrt_inv,
    compute_crlb_curve,
)

import numpy as np


def test_max_sep_observer_sequence_is_deterministic():
    seq1 = _max_sep_observer_sequence(weeks=10)
    seq2 = _max_sep_observer_sequence(weeks=10)
    assert [(p.lat, p.lon) for p in seq1] == [(p.lat, p.lon) for p in seq2]
    assert len(seq1) == 10
    # First observer is Seattle by construction
    assert round(seq1[0].lat, 1) == 47.6 and round(seq1[0].lon, 1) == -122.3


def test_trace_sqrt_inv_singular_returns_inf():
    """A rank-1 Fisher matrix is singular — CRLB is infinite."""
    J = np.array([[1.0, 0.0], [0.0, 0.0]])
    assert _trace_sqrt_inv(J) == float("inf")


def test_trace_sqrt_inv_identity():
    J = np.eye(2)  # var(east) = var(north) = 1 -> total radius = sqrt(2)
    assert abs(_trace_sqrt_inv(J) - np.sqrt(2)) < 1e-9


def test_crlb_week1_is_singular():
    """Only one measurement = rank-1 Fisher matrix = CRLB collapses to the
    script's infinity cap (10_000)."""
    curve = compute_crlb_curve("NOISY_GAUSSIAN_5", n_boxes=5)
    assert curve[0] >= 9999.0


def test_crlb_monotone_nonincreasing_after_week2():
    """Adding measurements can only increase Fisher info -> CRLB cannot grow."""
    curve = compute_crlb_curve("NOISY_GAUSSIAN_25", n_boxes=20)
    for w in range(2, len(curve)):
        assert curve[w] <= curve[w - 1] + 1e-6


def test_crlb_scales_with_noise():
    """CRLB radius scales linearly with noise sigma. ROUND_25 has variance
    25**2/12 vs NOISY_GAUSSIAN_5 with variance 25 -> ratio of stdevs ~= 1.44."""
    c_r25 = compute_crlb_curve("ROUND_25_MILES",   n_boxes=30)
    c_g5  = compute_crlb_curve("NOISY_GAUSSIAN_5", n_boxes=30)
    # At week 20 both should be finite
    assert c_r25[19] > c_g5[19]
    # Ratio should be approximately stdev ratio (sqrt(25**2/12) / 5 ≈ 1.44)
    ratio = c_r25[19] / c_g5[19]
    assert 1.2 < ratio < 1.7


def test_crlb_sigma25_floor_above_5mi():
    """σ=25 has CRLB > 5mi even at week 52 — the reason this mode has a
    persistent failure rate regardless of strategy."""
    curve = compute_crlb_curve("NOISY_GAUSSIAN_25", n_boxes=50)
    assert curve[51] > 5.0


def test_mode_variance_excludes_exact():
    """EXACT mode has zero noise variance -> dividing would blow up. Script
    explicitly omits it from the curve set."""
    assert "EXACT" not in MODE_VARIANCE_MI2
