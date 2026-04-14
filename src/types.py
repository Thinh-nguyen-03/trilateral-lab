from dataclasses import dataclass, field


@dataclass(frozen=True)
class Point:
    lat: float
    lon: float


@dataclass(frozen=True)
class Measurement:
    location: Point
    distance: float  # miles


@dataclass
class SearchState:
    week: int
    measurement_mode: str
    measurements: list[Measurement] = field(default_factory=list)
    uncertainty_radius: float = float("inf")
    best_estimate: Point = None
    belief: object = None  # reference to current Belief, for strategies that need it
