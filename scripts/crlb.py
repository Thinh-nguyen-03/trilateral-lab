#!/usr/bin/env python
"""
Compute the Cramer-Rao Lower Bound on localization radius as a function of
week number for each measurement mode. CRLB is the information-theoretic floor
on variance for any unbiased estimator given the noise model — it's the
absolute minimum any strategy could achieve, regardless of cleverness.

Model: d_i = haversine(obs_i, x) + eps_i, with
    ROUND_{delta}        : eps uniform[-delta/2, delta/2] -> var = delta**2 / 12
    NOISY_GAUSSIAN_sigma : eps ~ N(0, sigma**2)           -> var = sigma**2
    EXACT                : var = 0 -> CRLB collapses; excluded from the curves.

In a local east-north tangent plane centered on the box, the gradient of
distance wrt box position is the unit vector from the observer to the box.
So Fisher info per measurement is (u_i)(u_i)^T / var, and CRLB-equivalent
radius is sqrt(trace(J^-1)). We aggregate the median CRLB across M random
CONUS box locations, using a deterministic max_separation observer sequence.

Output:
    data/crlb.json = {
      "weeks":  [1, ..., 52],
      "curves": { mode: [r_w1, r_w2, ...] }   # median CRLB radius in miles
    }
"""
import json
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.environment import sample_box_location
from src.strategies.max_separation import MaxSeparationStrategy
from src.types import Measurement, Point, SearchState

MAX_WEEKS = 52
N_BOXES   = 200

# Modes with finite noise variance. EXACT is excluded (zero variance collapses CRLB).
MODE_VARIANCE_MI2 = {
    "ROUND_10_MILES":    (10  ** 2) / 12.0,
    "ROUND_25_MILES":    (25  ** 2) / 12.0,
    "ROUND_100_MILES":   (100 ** 2) / 12.0,
    "NOISY_GAUSSIAN_5":  5.0 ** 2,
    "NOISY_GAUSSIAN_25": 25.0 ** 2,
}

EARTH_RADIUS_MILES = 3958.8


def _max_sep_observer_sequence(weeks: int = MAX_WEEKS) -> list[Point]:
    """Deterministic max_separation observer sequence. Depends only on previous
    observers, not on the true box, so it's identical across boxes."""
    strategy = MaxSeparationStrategy()
    state = SearchState(week=0, measurement_mode="EXACT", measurements=[])
    obs_seq: list[Point] = []
    for w in range(weeks):
        state.week = w + 1
        p = strategy.choose_location(state)
        obs_seq.append(p)
        # Dummy distance — max_separation ignores measurement values.
        state.measurements.append(Measurement(location=p, distance=0.0))
    return obs_seq


def _crlb_radius_at_box(obs_seq: list[Point], box: Point, noise_var: float) -> list[float]:
    """Return the CRLB-equivalent radius (miles) for weeks 1..len(obs_seq).
    Uses a local east-north tangent frame centered on the box, which is accurate
    to well under 1% for CONUS-scale separations."""
    lat0 = math.radians(box.lat)
    cos_lat0 = math.cos(lat0)

    J = np.zeros((2, 2))
    radii: list[float] = []
    for obs in obs_seq:
        # East-north displacement from box to observer (miles)
        dlat_rad = math.radians(obs.lat - box.lat)
        dlon_rad = math.radians(obs.lon - box.lon)
        north = EARTH_RADIUS_MILES * dlat_rad
        east  = EARTH_RADIUS_MILES * cos_lat0 * dlon_rad
        dist = math.hypot(east, north)
        if dist < 1e-6:
            # Observer on top of box — pathological, skip this week's update
            radii.append(_trace_sqrt_inv(J))
            continue

        # Unit vector pointing from observer to box is -(east, north)/dist, but
        # the outer product is insensitive to sign.
        u = np.array([east / dist, north / dist])
        J += np.outer(u, u) / noise_var
        radii.append(_trace_sqrt_inv(J))
    return radii


def _trace_sqrt_inv(J: np.ndarray) -> float:
    """sqrt(trace(J^-1)) — the combined 1-sigma radius, inf if J is singular."""
    det = J[0, 0] * J[1, 1] - J[0, 1] * J[1, 0]
    if det <= 1e-20:
        return float("inf")
    trace_inv = (J[0, 0] + J[1, 1]) / det
    return math.sqrt(trace_inv)


def compute_crlb_curve(mode: str, n_boxes: int = N_BOXES, seed: int = 0) -> list[float]:
    """Median CRLB radius per week, across n_boxes random CONUS boxes."""
    import random
    random.seed(seed)
    np.random.seed(seed)

    noise_var = MODE_VARIANCE_MI2[mode]
    obs_seq = _max_sep_observer_sequence()
    boxes = [sample_box_location() for _ in range(n_boxes)]

    per_box = np.array([
        _crlb_radius_at_box(obs_seq, box, noise_var) for box in boxes
    ])  # (n_boxes, weeks)
    # Week 1 is rank-1 Fisher -> every box is inf. Convert to NaN and take
    # nanmedian while suppressing the "all-NaN slice" warning that week 1
    # deliberately triggers.
    per_box[np.isinf(per_box)] = np.nan
    import warnings
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=RuntimeWarning, message="All-NaN slice")
        median_curve = np.nanmedian(per_box, axis=0)
    # Any all-inf week collapses back to a large number — cap at 10_000 mi for plotting
    return [float(v) if np.isfinite(v) else 10_000.0 for v in median_curve]


def main():
    curves = {}
    for mode in MODE_VARIANCE_MI2:
        print(f"  CRLB: {mode}", flush=True)
        curves[mode] = compute_crlb_curve(mode)

    out = {
        "weeks":  list(range(1, MAX_WEEKS + 1)),
        "curves": curves,
        "n_boxes_per_mode": N_BOXES,
    }
    dest = Path(__file__).parent.parent / "data" / "crlb.json"
    with open(dest, "w") as f:
        json.dump(out, f, indent=2)
    print(f"Saved {dest}")


if __name__ == "__main__":
    main()
