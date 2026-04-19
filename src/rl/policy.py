"""Tiny numpy MLP used as the learned placement policy.

The architecture is deliberately small (input=OBS_DIM, hidden=16, tanh output 2)
so Cross-Entropy Method (CEM) has a manageable parameter space to optimise
without any deep-learning dependency. The policy maps a compact hand-engineered
observation (see build_observation) to a normalised (lat, lon) in [-1, 1],
which the strategy wrapper then maps to a CONUS candidate grid point.
"""
from __future__ import annotations

import numpy as np

OBS_DIM    = 8
HIDDEN_DIM = 16
ACT_DIM    = 2
PARAM_DIM  = OBS_DIM * HIDDEN_DIM + HIDDEN_DIM + HIDDEN_DIM * ACT_DIM + ACT_DIM


def unpack(flat: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Unpack a flat parameter vector into (W1, b1, W2, b2)."""
    assert flat.shape == (PARAM_DIM,), f"expected {PARAM_DIM}, got {flat.shape}"
    i = 0
    W1 = flat[i:i + OBS_DIM * HIDDEN_DIM].reshape(OBS_DIM, HIDDEN_DIM); i += OBS_DIM * HIDDEN_DIM
    b1 = flat[i:i + HIDDEN_DIM]; i += HIDDEN_DIM
    W2 = flat[i:i + HIDDEN_DIM * ACT_DIM].reshape(HIDDEN_DIM, ACT_DIM); i += HIDDEN_DIM * ACT_DIM
    b2 = flat[i:i + ACT_DIM]
    return W1, b1, W2, b2


def forward(flat: np.ndarray, obs: np.ndarray) -> np.ndarray:
    """Run the policy. obs: (OBS_DIM,). Returns action in [-1, 1]^2."""
    W1, b1, W2, b2 = unpack(flat)
    h = np.tanh(obs @ W1 + b1)
    return np.tanh(h @ W2 + b2)
