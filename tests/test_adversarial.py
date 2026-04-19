"""Smoke tests for the adversarial-placement script and its primitives."""
import subprocess
import sys
from pathlib import Path


def test_run_trial_accepts_fixed_box():
    """run_trial should use the provided box verbatim when passed."""
    from src.environment import Environment
    from src.simulation import run_trial
    from src.strategies.fixed import FixedStrategy
    from src.types import Point

    env = Environment("EXACT")
    box = Point(lat=40.0, lon=-100.0)
    r = run_trial(FixedStrategy(), env, box=box)
    assert r.box_lat == box.lat
    assert r.box_lon == box.lon


def test_run_trial_fixed_box_is_deterministic_for_exact():
    """Same seed + same box + EXACT should produce the same weeks."""
    import random
    import numpy as np
    from src.environment import Environment
    from src.simulation import run_trial
    from src.strategies.max_separation import MaxSeparationStrategy
    from src.types import Point

    env = Environment("EXACT")
    box = Point(lat=40.0, lon=-100.0)

    def once(seed):
        random.seed(seed)
        np.random.seed(seed)
        return run_trial(MaxSeparationStrategy(), env, box=box).weeks

    assert once(42) == once(42)


def test_cell_worker_returns_expected_structure():
    """The adversarial-placement worker should return the expected tuple shape."""
    sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
    from adversarial_placement import _cell_worker

    args = ("max_separation", "EXACT", 40.0, -100.0, 3, 7)
    name, mode, lat, lon, stats = _cell_worker(args)
    assert name == "max_separation"
    assert mode == "EXACT"
    assert lat == 40.0 and lon == -100.0
    assert stats is not None
    assert "mean_weeks" in stats
    assert "failure_rate" in stats
    assert 0 <= stats["failure_rate"] <= 1


def test_cell_worker_skips_cells_outside_conus():
    """Cells in the Atlantic or Pacific should return None stats."""
    sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
    from adversarial_placement import _cell_worker

    # Far off the Atlantic coast
    args = ("max_separation", "EXACT", 35.0, -60.0, 3, 1)
    _, _, _, _, stats = _cell_worker(args)
    assert stats is None
