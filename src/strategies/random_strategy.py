import random
from ..types import Point, SearchState
from ..environment import sample_box_location
from .base import Strategy


class RandomStrategy(Strategy):
    def choose_location(self, state: SearchState) -> Point:
        return sample_box_location()
