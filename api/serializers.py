import base64
import gzip

import numpy as np

from src.belief.grid import GridBelief
from src.belief.particle import ParticleFilter
from .models import GridBeliefModel, ParticleBeliefModel


def _pack(arr: np.ndarray) -> str:
    """Convert a numpy array to gzip-compressed float32 base64 string."""
    compressed = gzip.compress(arr.astype(np.float32).tobytes(), compresslevel=6)
    return base64.b64encode(compressed).decode()


def serialize_belief(belief) -> GridBeliefModel | ParticleBeliefModel:
    if isinstance(belief, GridBelief):
        w = belief.weights.ravel()
        return GridBeliefModel(
            weights_gz_b64=_pack(w),
            shape=belief.shape,
            nonzero_count=int(np.count_nonzero(w)),
        )
    elif isinstance(belief, ParticleFilter):
        return ParticleBeliefModel(
            lats_gz_b64=_pack(belief.lats),
            lons_gz_b64=_pack(belief.lons),
            weights_gz_b64=_pack(belief.weights),
            n_particles=belief.n,
        )
    else:
        raise TypeError(f"Unknown belief type: {type(belief)}")
