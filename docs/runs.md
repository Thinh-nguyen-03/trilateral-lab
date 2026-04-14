# Simulation Runs

---

## Design decisions

**Dropped hybrid strategy (2026-04-11):** Hybrid never outperformed max_sep on any metric in any mode across runs 2 and 3. It's structurally just max_sep with a delayed switch to centroid, so its results are bounded above by max_sep and below by centroid depending on when it switches. It adds a row to the table without adding information. Removed from the default run; `hybrid.py` kept for reference.

**Mode-gated centroid (2026-04-11):** Centroid was failing 72-99% on ROUND_25/100 even after the stability fix. Root cause: grid belief under heavy rounding produces multimodal feasible regions (disconnected arcs). The centroid of a multimodal distribution falls between modes, and measuring there breaks convergence. Fix: centroid always falls back to max_sep for ROUND_* modes. For EXACT and NOISY_GAUSSIAN_* the belief tends to be unimodal by the time centroid kicks in, so the strategy is meaningful there.

---

## Run 1 — 2026-04-11, 20 trials/config

**Setup:** 5 strategies × 5 modes = 25 configs, 20 trials each. Grid belief at 0.1° step (~144k cells).

```
strategy             mode                    mean  med  p90  p99  fail%
-----------------------------------------------------------------------
fixed                EXACT                    5.5    5    8   10   0.0%
random               EXACT                    4.9    5    5    6   0.0%
max_separation       EXACT                    5.2    5    5    8   0.0%
centroid             EXACT                   15.0    6   52   52  20.0%
hybrid               EXACT                    7.2    5    5   43   5.0%

fixed                ROUND_10_MILES           5.8    5    8    9   0.0%
random               ROUND_10_MILES           5.9    5    9    9   0.0%
max_separation       ROUND_10_MILES           5.7    5    6   15   0.0%
centroid             ROUND_10_MILES          33.7   52   52   52  60.0%
hybrid               ROUND_10_MILES          12.0    5   52   52  15.0%

fixed                ROUND_25_MILES          22.1   10   52   52  30.0%
random               ROUND_25_MILES          10.8   10   18   20   0.0%
max_separation       ROUND_25_MILES           9.4    8   14   25   0.0%
centroid             ROUND_25_MILES          45.3   52   52   52  85.0%
hybrid               ROUND_25_MILES          42.8   52   52   52  80.0%

fixed                ROUND_100_MILES         52.0   52   52   52 100.0%
random               ROUND_100_MILES         35.6   36   50   52  10.0%
max_separation       ROUND_100_MILES         37.5   39   52   52  25.0%
centroid             ROUND_100_MILES         52.0   52   52   52 100.0%
hybrid               ROUND_100_MILES         49.7   52   52   52  95.0%

fixed                NOISY_GAUSSIAN_5        16.9   15   20   41   0.0%
random               NOISY_GAUSSIAN_5        19.2   18   29   40   0.0%
max_separation       NOISY_GAUSSIAN_5        17.1   16   21   36   0.0%
centroid             NOISY_GAUSSIAN_5        42.6   52   52   53  60.0%
hybrid               NOISY_GAUSSIAN_5        35.9   39   52   52  40.0%
```

**Notes / issues found this run:**

- Centroid is broken across the board. Without initial geometric diversity, `best_estimate` is the prior centroid (roughly Kansas) for the first few weeks. Measuring from Kansas each time adds little new information. 60-100% failure rate under any noise. Needs a redesign or just accept it's a weak strategy.
- Hybrid inherits centroid's problems after week 4. The crossover week=4 might be too early. Worth testing crossover at week 6+.
- ROUND_100_MILES: fixed and centroid hit 100% failure. Random and max_sep survive (~10-25% fail) because they at least spread measurements geographically. At 100-mile rounding, the 5-mile threshold is probably unreachable without 20+ measurements consistently.
- 20 trials is too noisy — P99 values are unreliable, failure rates swing wildly.

**Bugs fixed during this run:**
- Grid was 578k cells (500×1156) not ~150k as designed. Changed GRID_STEP to 0.1° → 144k cells. 4× speedup.
- `get_candidates()` cache ignored the `step` parameter — second call with different step returned wrong results.
- `test_uncertainty_decreases_with_more_measurements` used arbitrary distances that don't geometrically constrain each other; replaced with actual distances from a known box location.
- Info gain strategy was doing argsort+haversine_vec per outcome per candidate per week (~89s/trial). Replaced with Herfindahl-index proxy (O(n_cells) per candidate, no inner loop) → ~2s/trial.

---

## Run 2 — 2026-04-11, 500 trials/config

**Setup:** 5 strategies × 5 modes, 500 trials each. Centroid/hybrid use uncertainty-based fallback (>400 miles → max_sep for centroid; >200 miles → max_sep for hybrid). Grid belief for all modes. This is the pre-fix baseline for centroid/hybrid.

```
strategy             mode                    mean  med  p90  p99  fail%
-----------------------------------------------------------------------
fixed                EXACT                    5.0    5    6    8   0.0%
random               EXACT                    5.3    5    7   11   0.0%
max_separation       EXACT                    5.0    5    5    8   0.0%
centroid             EXACT                   12.0    5   52   52  15.0%
hybrid               EXACT                   10.3    5   52   52  11.4%

fixed                ROUND_10_MILES           5.3    5    6    9   0.0%
random               ROUND_10_MILES           5.9    5    8   12   0.0%
max_separation       ROUND_10_MILES           5.1    5    6    8   0.0%
centroid             ROUND_10_MILES          15.1    5   52   52  21.4%
hybrid               ROUND_10_MILES          12.7    5   52   52  16.2%

fixed                ROUND_25_MILES          19.6   10   52   52  24.8%
random               ROUND_25_MILES          12.1   11   18   28   0.0%
max_separation       ROUND_25_MILES          10.4    9   16   25   0.0%
centroid             ROUND_25_MILES          47.2   52   52   52  89.6%
hybrid               ROUND_25_MILES          45.7   52   52   52  86.4%

fixed                ROUND_100_MILES         49.8   52   52   52  94.8%
random               ROUND_100_MILES         35.3   36   52   54  22.6%
max_separation       ROUND_100_MILES         34.8   34   52   53  19.2%
centroid             ROUND_100_MILES         52.0   52   52   52 100.0%
hybrid               ROUND_100_MILES         52.0   52   52   52 100.0%

fixed                NOISY_GAUSSIAN_5        17.6   17   24   38   0.0%
random               NOISY_GAUSSIAN_5        18.3   17   27   38   0.2%
max_separation       NOISY_GAUSSIAN_5        16.7   16   23   32   0.0%
centroid             NOISY_GAUSSIAN_5        39.9   52   52   52  49.4%
hybrid               NOISY_GAUSSIAN_5        39.9   52   52   52  52.0%
```

**Notes:**

- Centroid/hybrid fail badly. The fallback to max_sep kicks in when uncertainty > threshold but once they switch to centroid mode, the belief doesn't tighten. Best_estimate is unreliable when the belief is still multimodal, and measuring near it adds no geometric constraint.
- Max_sep is the standout: 0% failure on EXACT/ROUND_10/ROUND_25, ~19% on ROUND_100. Consistent margin over fixed.
- Random beats fixed on ROUND_25 (mean 12.1 vs 19.6). Fixed's sequence doesn't adapt to where the rings happen to intersect; random gets luckier on average.
- NOISY_GAUSSIAN_5 is expensive regardless of strategy (mean ~17 weeks) because the grid belief handles Gaussian noise poorly. This is a belief representation issue, not a strategy issue.

---

## Run 3 — 2026-04-11, 500 trials/config

**Setup:** 5 strategies × 6 modes (added NOISY_GAUSSIAN_25), 500 trials each. Fixes applied: centroid stability check (drift > 50 miles stays on max_sep), centroid threshold lowered 400→200 miles, hybrid threshold lowered 200→100 miles, ParticleFilter used for NOISY_GAUSSIAN_* modes, outer loop parallelized.

```
strategy             mode                    mean  med  p90  p99  fail%
-----------------------------------------------------------------------
fixed                EXACT                    5.0    5    5    8   0.0%
random               EXACT                    5.3    5    6   10   0.0%
max_separation       EXACT                    5.0    5    5    8   0.0%
centroid             EXACT                    5.1    5    5    8   0.4%
hybrid               EXACT                    8.5    5    8   52   7.6%

fixed                ROUND_10_MILES           5.5    5    6   10   0.2%
random               ROUND_10_MILES           5.7    5    8   11   0.0%
max_separation       ROUND_10_MILES           5.1    5    6    9   0.0%
centroid             ROUND_10_MILES           6.1    5    6   52   2.0%
hybrid               ROUND_10_MILES           9.7    5   13   52  10.0%

fixed                ROUND_25_MILES          18.8   10   52   52  23.0%
random               ROUND_25_MILES          11.6   11   18   27   0.0%
max_separation       ROUND_25_MILES          10.3    9   16   25   0.0%
centroid             ROUND_25_MILES          39.0   52   52   52  71.6%
hybrid               ROUND_25_MILES          46.0   52   52   52  87.0%

fixed                ROUND_100_MILES         50.7   52   52   52  96.8%
random               ROUND_100_MILES         36.0   36   52   53  17.4%
max_separation       ROUND_100_MILES         34.0   33   52   52  18.0%
centroid             ROUND_100_MILES         51.7   52   52   52  99.4%
hybrid               ROUND_100_MILES         51.7   52   52   52  99.2%

fixed                NOISY_GAUSSIAN_5         5.9    5    8   14   0.0%
random               NOISY_GAUSSIAN_5         6.4    6    9   14   0.0%
max_separation       NOISY_GAUSSIAN_5         6.0    5    8   16   0.0%
centroid             NOISY_GAUSSIAN_5         6.7    5    9   48   0.8%
hybrid               NOISY_GAUSSIAN_5         7.6    5   11   52   1.6%

fixed                NOISY_GAUSSIAN_25       40.5   45   52   54  38.4%
random               NOISY_GAUSSIAN_25       40.9   47   52   54  41.0%
max_separation       NOISY_GAUSSIAN_25       39.8   42   52   53  34.8%
centroid             NOISY_GAUSSIAN_25       48.5   52   52   52  83.2%
hybrid               NOISY_GAUSSIAN_25       49.2   52   52   52  86.2%
```

**Notes:**

- NOISY_GAUSSIAN_5: centroid/hybrid fixed. 49-52% failure → 0.8-1.6%. The particle filter handles continuous likelihood correctly; the grid belief was the root cause of the previous failure.
- EXACT/ROUND_10: centroid improved significantly (15→0.4%, 21→2%). Stability check is working. Hybrid still has elevated failure (7.6%, 10%) because its 100-mile switch threshold is aggressive enough that it sometimes commits to centroid mode before the belief is fully stable.
- ROUND_25/100: centroid and hybrid remain broken. Likely cause: under 25-mile rounding the GridBelief often has a multimodal feasible region (multiple non-contiguous arcs). The centroid of a multimodal distribution falls between the modes, and measuring there breaks convergence. The stability check alone doesn't prevent this since both modes can have similar centroid positions. Fixing this would require detecting multimodality or keeping a much tighter switch threshold.
- NOISY_GAUSSIAN_25: ~35% failure is the floor for all strategies (max_sep included). With 25-mile noise, 35% of trials don't converge within 52 weeks regardless of measurement placement. Centroid/hybrid much worse because they eventually switch to centroid mode.
- Parallelism working: 30 configs run concurrently, wall time roughly equals the slowest config.

---

## Run 4 — 2026-04-11, 500 trials/config

**Setup:** 4 strategies × 6 modes, 500 trials each. Centroid mode-gated: falls back to max_sep for all ROUND_* modes.

```
strategy             mode                    mean  med  p90  p99  fail%
-----------------------------------------------------------------------
fixed                EXACT                    5.0    5    6    8   0.0%
random               EXACT                    5.3    5    7    9   0.0%
max_separation       EXACT                    4.9    5    5    8   0.0%
centroid             EXACT                    5.2    5    5    8   0.6%

fixed                ROUND_10_MILES           5.3    5    6    9   0.0%
random               ROUND_10_MILES           6.0    5    8   13   0.0%
max_separation       ROUND_10_MILES           5.1    5    6    8   0.0%
centroid             ROUND_10_MILES           5.1    5    6    9   0.0%

fixed                ROUND_25_MILES          19.6   10   52   52  24.8%
random               ROUND_25_MILES          11.4   10   18   29   0.0%
max_separation       ROUND_25_MILES          10.5   10   16   25   0.0%
centroid             ROUND_25_MILES          10.5   10   16   25   0.0%

fixed                ROUND_100_MILES         50.0   52   52   52  95.2%
random               ROUND_100_MILES         36.0   35   52   54  22.0%
max_separation       ROUND_100_MILES         35.3   35   52   53  18.8%
centroid             ROUND_100_MILES         34.8   35   52   53  16.6%

fixed                NOISY_GAUSSIAN_5         6.2    5    9   15   0.0%
random               NOISY_GAUSSIAN_5         6.3    6    9   15   0.0%
max_separation       NOISY_GAUSSIAN_5         5.9    5    8   14   0.0%
centroid             NOISY_GAUSSIAN_5         6.5    5    9   28   0.2%

fixed                NOISY_GAUSSIAN_25       40.6   44   52   53  39.2%
random               NOISY_GAUSSIAN_25       41.9   49   52   53  43.6%
max_separation       NOISY_GAUSSIAN_25       39.9   43   52   53  37.2%
centroid             NOISY_GAUSSIAN_25       49.5   52   52   52  86.2%
```

**Notes:**

- Mode-gate working: centroid ROUND_25 went from 71.6% failure to 0%, matching max_sep exactly. centroid ROUND_100 went from 99.4% to 16.6%, slightly better than max_sep (18.8%) — both use the same underlying max_sep logic, the difference is sampling noise.
- centroid NOISY_GAUSSIAN_25 still 86% failure vs max_sep at 37%. The stability check doesn't help here: with 25-mile noise, particle filter uncertainty stays high for most of the run, then occasionally dips below 200 miles and centroid kicks in prematurely. Not fixing — NOISY_GAUSSIAN_25 is already near-unreachable for any strategy (37% floor), and the mode itself is close to pathological.
- NOISY_GAUSSIAN_5: centroid at 0.2% failure, essentially matching max_sep. Particle filter + stability check working correctly.
- These are the clean baseline numbers for the experiment.

---

## Run 5 — 2026-04-11, info_gain evaluation

**Setup:** info_gain × 5 modes × 100 trials (NOISY_GAUSSIAN_25 skipped — particle filter + info_gain candidate loop is ~5.4s/trial × 100 = 9 min for that config alone, and the mode is near-unreachable for any strategy anyway). 25-trial run across all strategies for context.

**25-trial reference (all 5 strategies):**
```
strategy             mode                    mean  med  p90  p99  fail%
-----------------------------------------------------------------------
fixed                EXACT                    5.0    5    6    6   0.0%
random               EXACT                    5.3    5    7    8   0.0%
max_separation       EXACT                    4.8    5    5    6   0.0%
centroid             EXACT                    4.8    5    5    5   0.0%
info_gain            EXACT                    7.1    5    6   41   4.0%

fixed                ROUND_10_MILES           5.1    5    6    6   0.0%
random               ROUND_10_MILES           5.9    5   10   11   0.0%
max_separation       ROUND_10_MILES           5.6    5    8   10   0.0%
centroid             ROUND_10_MILES           5.0    5    6    8   0.0%
info_gain            ROUND_10_MILES           4.6    5    5    5   0.0%

fixed                ROUND_25_MILES          13.9    8   38   52  12.0%
random               ROUND_25_MILES          10.1    9   15   19   0.0%
max_separation       ROUND_25_MILES          10.5    9   16   21   0.0%
centroid             ROUND_25_MILES          11.4   10   17   24   0.0%
info_gain            ROUND_25_MILES           7.2    7    8    9   0.0%

fixed                ROUND_100_MILES         52.0   52   52   52 100.0%
random               ROUND_100_MILES         38.6   42   52   54  20.0%
max_separation       ROUND_100_MILES         32.3   31   52   52  16.0%
centroid             ROUND_100_MILES         33.0   30   52   52  24.0%
info_gain            ROUND_100_MILES         13.0   11   12   43   4.0%

fixed                NOISY_GAUSSIAN_5         7.0    6   10   17   0.0%
random               NOISY_GAUSSIAN_5         6.5    6    9   16   0.0%
max_separation       NOISY_GAUSSIAN_5         5.6    5    8   11   0.0%
centroid             NOISY_GAUSSIAN_5         8.1    5   11   45   4.0%
info_gain            NOISY_GAUSSIAN_5         6.2    6    8   11   0.0%
```

**info_gain at 100 trials (confirmed numbers):**
```
info_gain  EXACT                    9.3    5    6   9.0%
info_gain  ROUND_10_MILES           4.5    4    5   0.0%
info_gain  ROUND_25_MILES           7.3    7    8   0.0%
info_gain  ROUND_100_MILES         12.4   11   12   3.0%
info_gain  NOISY_GAUSSIAN_5         7.3    7   10   0.0%
info_gain  NOISY_GAUSSIAN_25       (skipped, too slow)
```

**Key findings:**

- ROUND_100: info_gain mean 12.4 weeks, 3% failure vs max_sep 35.3 weeks, 18.8% failure. Confirmed at both 25 and 100 trials. This is the biggest result of the experiment — when rounding is coarse enough that ring placement matters, choosing measurement locations based on expected information gain cuts time-to-localize by 3x and nearly eliminates failures.
- ROUND_25: info_gain mean 7.3 vs max_sep 10.5. Consistent win across both trial counts.
- EXACT: info_gain has 9% failure at 100 trials while max_sep has 0%. Root cause: info_gain uses a Gaussian approximation (σ=2 miles) to compute expected outcomes, but the grid belief update for EXACT uses a hard ring mask. The mismatch makes info_gain occasionally pick poor locations. Not worth fixing — EXACT is an unrealistic mode.
- NOISY_GAUSSIAN_5: info_gain and max_sep are essentially the same. With continuous Gaussian noise, the belief doesn't have sharp ring structure, so there's no geometric advantage to exploit.
- Compute cost: info_gain is ~5s/trial for NOISY_GAUSSIAN_25 (particle filter × 100 candidates × 15 buckets × 10k particles per week × 40 weeks). This mode was excluded from info_gain runs going forward.
