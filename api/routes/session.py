import asyncio
from typing import Annotated

import numpy as np
from fastapi import APIRouter, Depends, HTTPException

from src.belief.grid import GridBelief, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, GRID_STEP
from src.belief.particle import ParticleFilter
from src.environment import Environment
from src.simulation import LOCALIZATION_THRESHOLD_MILES, MAX_WEEKS
from src.strategies.candidates import get_candidates
from src.types import Measurement, Point, SearchState

from ..models import (
    EllipseModel,
    GainMapResponse,
    GainPoint,
    GridMeta,
    MeasurementModel,
    PointModel,
    StartSessionRequest,
    StartSessionResponse,
    StepRequest,
    StepResponse,
    VALID_MODES,
    VALID_STRATEGIES,
)
from ..serializers import serialize_belief

router = APIRouter()

_GAUSSIAN_MODES = {"NOISY_GAUSSIAN_5", "NOISY_GAUSSIAN_25"}

_EARTH_RADIUS_MILES = 3958.8
_GAIN_MAX_CELLS = 3000


def _gain_map_scores(
    cand_lats: np.ndarray,
    cand_lons: np.ndarray,
    w: np.ndarray,
    lats: np.ndarray,
    lons: np.ndarray,
    mode: str,
) -> np.ndarray:
    lat1 = np.radians(cand_lats)[:, None]
    lon1 = np.radians(cand_lons)[:, None]
    lat2 = np.radians(lats)[None, :]
    lon2 = np.radians(lons)[None, :]
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    h = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    dists = 2 * _EARTH_RADIUS_MILES * np.arcsin(np.sqrt(h))

    if mode == "EXACT" or mode.startswith("ROUND_"):
        bin_size = 2.0 if mode == "EXACT" else float(mode.split("_")[1])
        ids = np.round(dists / bin_size).astype(np.int32)
        ids -= ids.min(axis=1, keepdims=True)
        n_bins = int(ids.max()) + 1
        n_cands = cand_lats.shape[0]
        offsets = (np.arange(n_cands, dtype=np.int32) * n_bins)[:, None]
        flat_ids = (ids + offsets).ravel()
        flat_w = np.broadcast_to(w, (n_cands, w.shape[0])).ravel()
        totals = np.bincount(flat_ids, weights=flat_w, minlength=n_cands * n_bins)
        group_w = totals.reshape(n_cands, n_bins)
        return (group_w ** 2).sum(axis=1)

    if mode in ("NOISY_GAUSSIAN_5", "NOISY_GAUSSIAN_25"):
        sigma = 5.0 if mode == "NOISY_GAUSSIAN_5" else 25.0
        mean_d = (w[None, :] * dists).sum(axis=1)
        lo = np.maximum(0.0, mean_d - 3 * sigma)[:, None]
        hi = (mean_d + 3 * sigma)[:, None]
        centers = lo + (hi - lo) * np.linspace(0.0, 1.0, 15)[None, :]
        n_cands = cand_lats.shape[0]
        group_p = np.empty((n_cands, 15), dtype=np.float64)
        for b in range(15):
            diffs = dists - centers[:, b:b + 1]
            kernel = np.exp(-0.5 * (diffs / sigma) ** 2)
            group_p[:, b] = (w[None, :] * kernel).sum(axis=1)
        totals = group_p.sum(axis=1, keepdims=True)
        safe = totals > 1e-10
        group_p = np.where(safe, group_p / np.where(safe, totals, 1.0), 0.0)
        scores = (group_p ** 2).sum(axis=1)
        scores[~safe.ravel()] = np.inf
        return scores

    return np.full(cand_lats.shape[0], np.inf)

_GRID_META = GridMeta(
    lat_min=LAT_MIN,
    lat_max=LAT_MAX,
    lon_min=LON_MIN,
    lon_max=LON_MAX,
    step=GRID_STEP,
    n_lats=round((LAT_MAX - LAT_MIN) / GRID_STEP),
    n_lons=round((LON_MAX - LON_MIN) / GRID_STEP),
)


def _get_store():
    from ..main import store
    return store


def _build_strategy(name: str):
    from src.evaluator import _build_registry
    registry = _build_registry()
    return registry[name]()


@router.post("/session/start", response_model=StartSessionResponse)
async def start_session(req: StartSessionRequest, store=Depends(_get_store)):
    if req.strategy not in VALID_STRATEGIES:
        raise HTTPException(400, f"Unknown strategy '{req.strategy}'. Valid: {sorted(VALID_STRATEGIES)}")
    if req.measurement_mode not in VALID_MODES:
        raise HTTPException(400, f"Unknown mode '{req.measurement_mode}'. Valid: {sorted(VALID_MODES)}")

    loop = asyncio.get_event_loop()

    env = Environment(req.measurement_mode)
    if req.box_location is not None:
        # Clamp to grid bounds in case client sends a point just outside
        box = Point(
            lat=max(LAT_MIN, min(LAT_MAX, req.box_location.lat)),
            lon=max(LON_MIN, min(LON_MAX, req.box_location.lon)),
        )
    else:
        box = await loop.run_in_executor(None, env.sample_box_location)

    belief = (
        ParticleFilter(req.measurement_mode)
        if req.measurement_mode in _GAUSSIAN_MODES
        else GridBelief(req.measurement_mode)
    )

    try:
        strategy = _build_strategy(req.strategy)
    except FileNotFoundError as e:
        raise HTTPException(400, str(e))
    strategy.reset()

    state = SearchState(
        week=0,
        measurement_mode=req.measurement_mode,
        measurements=[],
        uncertainty_radius=float("inf"),
        best_estimate=None,
        belief=belief,
    )

    sid = store.create(env, belief, strategy, state, box)

    return StartSessionResponse(
        session_id=sid,
        strategy=req.strategy,
        measurement_mode=req.measurement_mode,
        grid_meta=_GRID_META,
        box_location=PointModel(lat=box.lat, lon=box.lon),
    )


@router.post("/session/{session_id}/step", response_model=StepResponse)
async def step(session_id: str, req: StepRequest = StepRequest(), store=Depends(_get_store)):
    entry = store.get(session_id)
    if entry is None:
        raise HTTPException(404, "Session not found or expired")

    state = entry.state
    state.week += 1

    loop = asyncio.get_event_loop()

    strategy_name = type(entry.strategy).__name__
    is_manual = strategy_name == "ManualStrategy"

    if is_manual:
        if req.location is None:
            raise HTTPException(400, "Manual strategy requires a 'location' in the step body.")
        location = Point(
            lat=max(LAT_MIN, min(LAT_MAX, req.location.lat)),
            lon=max(LON_MIN, min(LON_MAX, req.location.lon)),
        )
    else:
        location = await loop.run_in_executor(None, entry.strategy.choose_location, state)

    distance = entry.env.measure_distance(location, entry.box)

    await loop.run_in_executor(None, entry.belief.update, location, distance)

    state.measurements.append(Measurement(location, distance))
    state.uncertainty_radius = entry.belief.uncertainty_radius()
    state.best_estimate = entry.belief.best_estimate()
    state.belief = entry.belief

    localized = state.uncertainty_radius < LOCALIZATION_THRESHOLD_MILES
    trial_complete = localized or state.week >= MAX_WEEKS

    belief_payload = serialize_belief(entry.belief)

    box_location = None
    if trial_complete:
        box_location = PointModel(lat=entry.box.lat, lon=entry.box.lon)
        store.delete(session_id)

    gain_map_points = None
    if req.include_gain_map and not trial_complete:
        belief = entry.belief
        mode = state.measurement_mode
        if isinstance(belief, GridBelief):
            gm_w    = belief.weights.ravel()
            gm_lats = belief.lat_grid.ravel()
            gm_lons = belief.lon_grid.ravel()
        else:
            gm_w    = belief.weights
            gm_lats = belief.lats
            gm_lons = belief.lons

        if gm_w.size > _GAIN_MAX_CELLS:
            top_idx = np.argpartition(gm_w, -_GAIN_MAX_CELLS)[-_GAIN_MAX_CELLS:]
            gm_w, gm_lats, gm_lons = gm_w[top_idx], gm_lats[top_idx], gm_lons[top_idx]
        total_w = float(gm_w.sum())
        if total_w > 0:
            gm_w = gm_w / total_w

        candidates = get_candidates(step=3.0)
        cand_lats = np.array([c.lat for c in candidates], dtype=np.float64)
        cand_lons = np.array([c.lon for c in candidates], dtype=np.float64)

        def _gm_compute():
            scores = _gain_map_scores(cand_lats, cand_lons, gm_w, gm_lats, gm_lons, mode)
            finite = np.isfinite(scores)
            if not np.any(finite):
                return []
            s_min, s_max = float(scores[finite].min()), float(scores[finite].max())
            rng = s_max - s_min if s_max > s_min else 1.0
            gains = np.where(finite, (s_max - scores) / rng, 0.0)
            return [GainPoint(lat=c.lat, lon=c.lon, gain=float(g)) for c, g in zip(candidates, gains)]
        gain_map_points = await loop.run_in_executor(None, _gm_compute)

    ellipse = entry.belief.covariance_ellipse() if not trial_complete else None
    ellipse_payload = (
        EllipseModel(
            center_lat=ellipse[0],
            center_lon=ellipse[1],
            semi_major_mi=ellipse[2],
            semi_minor_mi=ellipse[3],
            angle_deg=ellipse[4],
        )
        if ellipse is not None
        else None
    )

    return StepResponse(
        week=state.week,
        localized=localized,
        trial_complete=trial_complete,
        chosen_location=PointModel(lat=location.lat, lon=location.lon),
        observed_distance=distance,
        best_estimate=(
            PointModel(lat=state.best_estimate.lat, lon=state.best_estimate.lon)
            if state.best_estimate else None
        ),
        uncertainty_radius=state.uncertainty_radius,
        measurements=[
            MeasurementModel(
                location=PointModel(lat=m.location.lat, lon=m.location.lon),
                distance=m.distance,
            )
            for m in state.measurements
        ],
        belief=belief_payload,
        box_location=box_location,
        gain_map_points=gain_map_points,
        ellipse=ellipse_payload,
    )


@router.post("/session/{session_id}/gain-map", response_model=GainMapResponse)
async def gain_map(session_id: str, store=Depends(_get_store)):
    """Compute the expected information gain for each candidate measurement
    location across CONUS at a coarse 1-degree resolution. Returned as the
    *normalized* gain (0 = no information shrinkage, 1 = best candidate).

    The score is `1 - H/H_uniform` where `H` is the Herfindahl index of the
    expected outcome distribution — the same quantity InfoGainStrategy minimizes.
    Lower Herfindahl ⇒ more uniform outcome distribution ⇒ more expected
    information gain.
    """
    entry = store.get(session_id)
    if entry is None:
        raise HTTPException(404, "Session not found or expired")

    belief = entry.belief
    mode = entry.state.measurement_mode

    if isinstance(belief, GridBelief):
        w = belief.weights.ravel()
        lats = belief.lat_grid.ravel()
        lons = belief.lon_grid.ravel()
    elif isinstance(belief, ParticleFilter):
        w = belief.weights
        lats = belief.lats
        lons = belief.lons
    else:
        raise HTTPException(400, "Unsupported belief type for gain map")

    if w.size > _GAIN_MAX_CELLS:
        top_idx = np.argpartition(w, -_GAIN_MAX_CELLS)[-_GAIN_MAX_CELLS:]
        w, lats, lons = w[top_idx], lats[top_idx], lons[top_idx]
    total_w = float(w.sum())
    if total_w > 0:
        w = w / total_w

    candidates = get_candidates(step=3.0)
    cand_lats = np.array([c.lat for c in candidates], dtype=np.float64)
    cand_lons = np.array([c.lon for c in candidates], dtype=np.float64)

    loop = asyncio.get_event_loop()

    def _compute():
        scores = _gain_map_scores(cand_lats, cand_lons, w, lats, lons, mode)
        finite = np.isfinite(scores)
        if not np.any(finite):
            return [], 0.0
        s_min = float(scores[finite].min())
        s_max = float(scores[finite].max())
        rng = s_max - s_min if s_max > s_min else 1.0
        gains = np.where(finite, (s_max - scores) / rng, 0.0)
        out = [
            GainPoint(lat=c.lat, lon=c.lon, gain=float(g))
            for c, g in zip(candidates, gains)
        ]
        return out, float(gains.max())

    points, max_gain = await loop.run_in_executor(None, _compute)
    return GainMapResponse(points=points, max_gain=max_gain)


@router.delete("/session/{session_id}", status_code=204)
def delete_session(session_id: str, store=Depends(_get_store)):
    store.delete(session_id)
