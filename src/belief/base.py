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
