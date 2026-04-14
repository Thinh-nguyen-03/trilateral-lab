from abc import ABC, abstractmethod
from ..types import Point, SearchState


class Strategy(ABC):
    def reset(self) -> None:
        """Called at the start of each trial. Override to clear per-trial state."""
        pass

    @abstractmethod
    def choose_location(self, state: SearchState) -> Point:
        ...
