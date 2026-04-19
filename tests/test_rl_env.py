"""Tests for the RL placement env + CEM policy. Verifies the gym-style
contract and that the reward structure behaves correctly — not that any
particular policy is good (that's the trainer's job)."""
import numpy as np

from src.rl.env import PlacementEnv
from src.rl.policy import PARAM_DIM, forward
from src.simulation import MAX_WEEKS


def test_env_reset_returns_obs_of_expected_shape():
    env = PlacementEnv("ROUND_100_MILES", seed=0)
    obs = env.reset()
    assert obs.shape == (8,)
    # All components normalised to roughly [-1, 1]
    assert -1.1 < obs.min() and obs.max() < 1.1 + 1e-9


def test_env_step_returns_tuple():
    env = PlacementEnv("ROUND_100_MILES", seed=0)
    env.reset()
    action = np.zeros(2)  # center of CONUS bbox
    obs, reward, done, info = env.step(action)
    assert obs.shape == (8,)
    assert isinstance(reward, float)
    assert isinstance(done, bool)
    assert info.week == 1


def test_env_per_week_reward_is_negative_one_when_not_localised():
    env = PlacementEnv("ROUND_100_MILES", seed=0)
    env.reset()
    # Bogus action; unlikely to localise in one step from 100-mile-rounded obs
    _, reward, done, info = env.step(np.array([0.9, -0.9]))
    if not done:
        assert reward == -1.0


def test_env_times_out_after_max_weeks():
    env = PlacementEnv("ROUND_100_MILES", seed=0)
    env.reset()
    # Same action every week — bad policy, should time out
    done = False
    weeks = 0
    while not done:
        _, _, done, info = env.step(np.zeros(2))
        weeks += 1
        if weeks > MAX_WEEKS + 1:
            raise AssertionError("env ran past MAX_WEEKS")
    assert info.week == MAX_WEEKS
    assert not info.localized


def test_policy_forward_output_shape_and_range():
    theta = np.zeros(PARAM_DIM)
    obs = np.zeros(8)
    a = forward(theta, obs)
    assert a.shape == (2,)
    # tanh output is in [-1, 1]
    assert -1.0 <= a.min() and a.max() <= 1.0


def test_policy_forward_is_deterministic():
    theta = np.random.default_rng(7).normal(size=PARAM_DIM)
    obs = np.random.default_rng(9).normal(size=8)
    a1 = forward(theta, obs)
    a2 = forward(theta, obs)
    assert np.allclose(a1, a2)


def test_cem_one_generation_runs():
    """Single-generation sanity check — just verify nothing blows up."""
    from scripts.train_cem_policy import train
    theta, log = train(generations=1, pop_size=4, k_rollouts=2)
    assert theta.shape == (PARAM_DIM,)
    assert len(log) == 1
    assert "mean_fitness" in log[0]
