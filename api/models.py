from __future__ import annotations

from typing import Literal, Optional, Union
from pydantic import BaseModel


class PointModel(BaseModel):
    lat: float
    lon: float


class MeasurementModel(BaseModel):
    location: PointModel
    distance: float


class GridBeliefModel(BaseModel):
    type: Literal["grid"] = "grid"
    weights_gz_b64: str      # gzip-compressed float32 array, base64 encoded
    shape: tuple[int, int]   # (n_lats, n_lons) — always (250, 578)
    nonzero_count: int


class ParticleBeliefModel(BaseModel):
    type: Literal["particles"] = "particles"
    lats_gz_b64: str         # gzip float32
    lons_gz_b64: str
    weights_gz_b64: str
    n_particles: int


class GridMeta(BaseModel):
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    step: float
    n_lats: int
    n_lons: int


class StartSessionRequest(BaseModel):
    strategy: str       # "fixed" | "random" | "max_separation" | "centroid" | "info_gain"
    measurement_mode: str  # "EXACT" | "ROUND_10_MILES" | etc.
    box_location: Optional[PointModel] = None  # if provided, use this as the hidden target


class StartSessionResponse(BaseModel):
    session_id: str
    strategy: str
    measurement_mode: str
    grid_meta: GridMeta
    box_location: PointModel  # always returned so UI can display target pre-sim


class StepResponse(BaseModel):
    week: int
    localized: bool
    trial_complete: bool
    chosen_location: PointModel
    observed_distance: float
    best_estimate: Optional[PointModel]
    uncertainty_radius: float
    measurements: list[MeasurementModel]
    belief: Union[GridBeliefModel, ParticleBeliefModel]
    box_location: Optional[PointModel] = None  # revealed only when trial_complete


VALID_STRATEGIES = {"fixed", "random", "max_separation", "centroid", "info_gain", "entropy_gradient"}
VALID_MODES = {
    "EXACT",
    "ROUND_10_MILES",
    "ROUND_25_MILES",
    "ROUND_100_MILES",
    "NOISY_GAUSSIAN_5",
    "NOISY_GAUSSIAN_25",
}
