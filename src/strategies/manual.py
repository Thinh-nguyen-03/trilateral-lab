from ..types import Point, SearchState
from .base import Strategy


class ManualStrategy(Strategy):
    """No-op strategy — the caller supplies the measurement location directly.

    Used by the interactive UI where the user clicks the map each week. The
    step endpoint must pass a location explicitly; calling choose_location
    here is a bug.
    """

    def choose_location(self, state: SearchState) -> Point:
        raise RuntimeError(
            "ManualStrategy.choose_location called — the session endpoint must "
            "pass an explicit location for manual strategy."
        )
