# Next Features — Senior-Signal Roadmap

A focused set of additions picked to move the project beyond "nice portfolio demo"
into depth-signaling territory: interactivity a recruiter can play with, game-theoretic
framing, information-theoretic bounds, and a learned policy. Implementation order
is deliberately easy → hard so there's always a shippable milestone.

---

## Progress Tracker

| # | Feature | Status | Scope |
|---|---------|--------|-------|
| N1 | [Play-It-Yourself Mode](#n1-play-it-yourself-mode) | `in-progress` | UI + small API tweak |
| N2 | [Adversarial Box Placement](#n2-adversarial-box-placement) | `pending` | Backend + analysis |
| N3 | [CRLB Overlay](#n3-crlb-overlay) | `pending` | Backend + chart |
| N4 | [RL-Trained Strategy](#n4-rl-trained-strategy) | `pending` | Training infra + new strategy |

**Status values:** `pending` → `in-progress` → `complete` → `blocked`

---

## N1 — Play-It-Yourself Mode

**What**
A `manual` strategy option. When selected, the user clicks the map each week to
place their own measurement. The game tells them their weeks-to-localize, and
overlays the aggregate mean weeks for `max_separation` and `info_gain` on the
same mode as reference lines so they can see how they compare.

**Why it matters**
Single most viral demo piece. Converts a passive viewer into an engaged player
and lets them *feel* why measurement placement matters — especially in
ROUND_100 and NOISY_25 modes where humans tend to do worse than info_gain.

**Design**

- New strategy `manual` in the backend that raises if `choose_location` is ever
  called (defensive — the step endpoint should short-circuit).
- `POST /session/{id}/step` accepts an optional `location: PointModel` in the
  body. If present, it's used verbatim instead of calling `strategy.choose_location`.
- Validation: `manual` strategy *requires* a location in the step request;
  other strategies ignore it if provided.
- Frontend:
  - Add `MANUAL (YOU PICK)` to the strategy dropdown
  - When `strategy === 'manual'` and `status === 'running'`, the map enters a
    pick-measurement mode: cursor → crosshair, click commits the measurement
    and triggers the step
  - A small HUD overlay reminds the user to click the map
  - Auto-play is disabled for manual strategy

**Files to touch**

Backend:
- `api/models.py` — add `manual` to `VALID_STRATEGIES`, extend `StepRequest`
  (new) to allow optional `location`
- `api/routes/session.py` — branch on body presence
- `src/strategies/manual.py` — new no-op strategy
- `src/strategies/__init__.py` / `src/evaluator.py` registry — include manual
  (but skip it from evaluator runs)

Frontend:
- `web/src/api/session.ts` — `stepSession` accepts optional `location`
- `web/src/store/simulationStore.ts` — nothing required; strategy is already a string
- `web/src/components/simulation/StrategyModeForm.tsx` — add option
- `web/src/components/simulation/StepControls.tsx` — hide step/auto buttons for
  manual strategy, show "CLICK MAP" hint instead
- `web/src/components/map/SimulationMap.tsx` — add click handler that fires a
  step when strategy is manual and status is running
- `web/src/hooks/useSimulation.ts` — `step` accepts optional `location`

Tests:
- `tests/test_manual_strategy.py` — end-to-end with the API (or direct call) —
  verify location is respected, belief updates correctly, manual without
  location raises

---

## N2 — Adversarial Box Placement

**What**
A mode where the box is placed to *maximize* expected weeks-to-localize given
a known strategy, rather than sampled uniformly. For each candidate box
location on a coarse grid, run K trials of the target strategy with the box
fixed at that spot, record mean weeks, and pick the argmax. Store the map
of `box_location → difficulty` and surface it as:
  1. A choropleth heatmap of "hardest regions" per strategy
  2. A new results-table column "adversarial mean weeks"
  3. An optional placement mode in the simulation UI: `RANDOM | PICK ON MAP | ADVERSARIAL`
     that places the box at the precomputed hardest point for the selected
     strategy+mode

**Why it matters**
Reframes the Monte Carlo study as a minimax game — your strategy has to do
well in the worst case, not just on average. This framing is dramatically more
interesting to a senior engineer than yet another aggregate stat.

**Design**

- New script `scripts/adversarial_placement.py`:
  - For each `(strategy, mode)` pair (skip `manual`), loop over a coarse
    candidate grid (2° lat/lon) inside CONUS
  - For each candidate, run K=25 trials of the target strategy with box fixed
    at that candidate (random seeds, all randomness still applies to noise)
  - Record mean weeks and failure rate per candidate
  - Store the full map in `data/adversarial.json`
  - Print the worst-case box per `(strategy, mode)`
- `src/simulation.py::run_trial` already accepts the box via env, but the
  sampler is baked in — add `run_trial_fixed_box(strategy, env, box)` helper
- Backend:
  - `GET /api/adversarial` — serve `data/adversarial.json`
  - `POST /api/session/start` already accepts `box_location` — add a convenience:
    the frontend can look up the worst-case box for the selected strategy/mode
- Frontend:
  - `web/src/pages/DashboardPage.tsx` — new section "§04 ADVERSARIAL LANDSCAPE"
    with a small-multiples choropleth: one panel per strategy, color = mean
    weeks when box is placed there
  - `web/src/components/simulation/StrategyModeForm.tsx` — add "ADVERSARIAL"
    placement button that fetches the worst-case box for the current strategy+mode

Tests:
- `tests/test_adversarial.py` — placeholder trial runs, assert structure of
  the output, quick sanity check that the same seed produces deterministic
  results

---

## N3 — CRLB Overlay

**What**
Compute the Cramér-Rao Lower Bound on localization variance as a function of
week number for each measurement mode. This is the information-theoretic
minimum variance any unbiased estimator can achieve given the noise model.
Plot it as a dashed line on the convergence curves chart alongside the
strategy median-radius traces.

**Why it matters**
Shows the reader *why* NOISY_GAUSSIAN_25 has a ~35% failure floor — it's not
a strategy defect, it's the CRLB. The gap between the best strategy and CRLB
is also diagnostic: small gap means strategies are near-optimal; large gap
means there's signal left on the table (e.g. info_gain on ROUND_100 closes
the gap vs max_sep).

**Design**

For a location estimate `x̂` at week `w` with measurement model
`d_i = haversine(obs_i, x) + ε_i`, the Fisher information is:

```
J(x) = Σ_i (∂d_i/∂x)ᵀ (∂d_i/∂x) / σ²
```

For the Gaussian modes, σ is known. For rounding modes, uniform quantization
noise has variance `Δ²/12` where `Δ` is the rounding step (10, 25, 100 miles).

CRLB on position variance: `Cov(x̂) ≥ J(x)⁻¹`. Convert to an "equivalent radius"
by taking the trace and √.

- Script: `scripts/crlb.py` — for each mode, for each week 1..52, compute CRLB
  as a Monte Carlo average over the same observer positions the `max_separation`
  strategy would pick (this is a decent proxy; ideally we'd compute CRLB given
  the actual path each strategy took, but that requires per-trial traces).
- Serve via `data/crlb.json` and a new GET endpoint.
- Add CRLB trace to `ConvergenceCurves.tsx` on DashboardPage — dashed black line.

Tests:
- `tests/test_crlb.py` — for EXACT mode, CRLB should approach zero fast (Fisher
  info grows with each measurement in general position). For σ=25 mode, CRLB
  should be clearly bounded below by a non-trivial value.

---

## N4 — RL-Trained Strategy

**What**
Train a policy network that chooses the next measurement location given the
current belief and measurement history. Targeted at the regimes where
`info_gain` and `max_sep` show a gap vs. CRLB: ROUND_100 and NOISY_GAUSSIAN_25.

**Why it matters**
Demonstrates ML infra chops (gym env, training loop, eval protocol) beyond
applied stats. If the learned policy beats `info_gain` on either hard mode,
that's a publishable result. Even if it doesn't, the negative result is
informative and shows the `info_gain` heuristic is near-optimal.

**Design**

- `src/rl/env.py` — Gymnasium environment wrapping `Environment` + `GridBelief`
  - Observation: coarse (36×36) downsampled belief grid + last 4 (obs_lat, obs_lon, dist)
  - Action: continuous (lat, lon), bounded to CONUS
  - Reward: `-1` per week; `+100` on localization; `-50` on MAX_WEEKS timeout
- Training: PPO via `stable-baselines3` on ROUND_100 mode
  - 1M timesteps, ~1 hour on CPU
  - Checkpoint saved to `data/rl_policy_round100.zip`
- Inference strategy `src/strategies/rl.py` — loads the policy, calls
  `predict()` on the current belief
- New row on all existing charts

Tests:
- `tests/test_rl_env.py` — env conforms to gym API, reset/step work, reward
  signs correct

**Stretch**
- Multi-mode policy (condition on measurement mode as part of observation)
- Imitation-learn from `info_gain` first, then fine-tune with RL (much faster
  convergence)

---

*Last updated: 2026-04-18*
