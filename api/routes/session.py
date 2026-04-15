import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from src.belief.grid import GridBelief, LAT_MIN, LAT_MAX, LON_MIN, LON_MAX, GRID_STEP
from src.belief.particle import ParticleFilter
from src.environment import Environment
from src.simulation import LOCALIZATION_THRESHOLD_MILES, MAX_WEEKS
from src.types import Measurement, SearchState

from ..models import (
    GridMeta,
    MeasurementModel,
    PointModel,
    StartSessionRequest,
    StartSessionResponse,
    StepResponse,
    VALID_MODES,
    VALID_STRATEGIES,
)
from ..serializers import serialize_belief

router = APIRouter()

_GAUSSIAN_MODES = {"NOISY_GAUSSIAN_5", "NOISY_GAUSSIAN_25"}

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
    box = await loop.run_in_executor(None, env.sample_box_location)

    belief = (
        ParticleFilter(req.measurement_mode)
        if req.measurement_mode in _GAUSSIAN_MODES
        else GridBelief(req.measurement_mode)
    )

    strategy = _build_strategy(req.strategy)
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
    )


@router.post("/session/{session_id}/step", response_model=StepResponse)
async def step(session_id: str, store=Depends(_get_store)):
    entry = store.get(session_id)
    if entry is None:
        raise HTTPException(404, "Session not found or expired")

    state = entry.state
    state.week += 1

    loop = asyncio.get_event_loop()

    # Both choose_location and belief.update can be CPU-heavy (InfoGain ~300ms).
    # Run them in a thread pool so the event loop stays free.
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
    )


@router.delete("/session/{session_id}", status_code=204)
def delete_session(session_id: str, store=Depends(_get_store)):
    store.delete(session_id)
