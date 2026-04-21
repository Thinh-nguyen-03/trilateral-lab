from abc import ABC, abstractmethod
from ..types import Point


class Belief(ABC):
    @abstractmethod
    def update(self, observer: Point, observed_distance: float) -> None:
        ...

    @abstractmethod
    def uncertainty_radius(self) -> float:
        """Radius in miles of the smallest circle enclosing 95% of probability mass."""
        ...

    @abstractmethod
    def best_estimate(self) -> Point:
        """Weighted centroid of current belief."""
        ...

    def covariance_ellipse(self) -> tuple[float, float, float, float, float] | None:
        """Returns (center_lat, center_lon, semi_major_mi, semi_minor_mi, angle_deg)
        for the 95% confidence ellipse, or None if undefined.
        angle_deg is the rotation of the major axis CCW from east.
        """
        return None
