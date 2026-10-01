# Evidence

## Purpose

Own how Chessview turns engine and human statistical data into semantic evidence signals such as move quality, human-result quality, mismatch, Prevalence, and Root rarity.

Evidence owns the meaning, calculation, and epistemic state of those signals. Consumers such as [Constellation selection](constellation-selection.md), [Rail](rail.md), and [Interface](interface.md) own how those signals affect eligibility, navigation, or presentation.

Source clients own whether their source data is fit to expose. In particular, [`LichessEval`](../architecture/lichess-eval.md) owns cloud-evaluation acquisition, cache/freshness policy, validation, and minimum usable source depth; Evidence receives only usable cloud evaluation or absence and does not reinterpret transport/cache state.

## Product criticality

Evidence is not structural or supplementary solely because of its source. Criticality follows how the current view uses it.

For the current automatic Constellation flow, rated Explorer acquisition is structural when another Explorer Reading can still change the constrained graph composition. Prevalence and human-result evidence arrive as part of that graph-bearing Reading and may influence selection once available.

Cloud evaluation is not proactively acquired merely to settle Constellation selection. Selection may consume engine evidence already available through `LichessEval.available()`. If no usable engine value is already available, the engine signal remains unknown; that absence does not create a pending structural dependency and does not keep Weather unsettled. Cloud evaluation acquired for annotations, Rail enrichment, diagnostics, or opportunistic background warming remains supplementary to the current view.

Unavailable evidence remains unknown rather than negative chess evidence. Failure of supplementary or background acquisition reduces richness rather than structural usability. Source-specific operational failure remains available through the owning source client's operational channel; it must not be encoded as negative chess evidence or by itself reopen Weather.

## Engine evidence

- Evidence receives only cloud evaluations that `LichessEval` considers usable.
- The current center position has an absolute-evaluation signal when usable engine source data exists.
- Root and Line moves have a move-loss signal versus the best move rather than inheriting the target's absolute evaluation directly.
- When source MultiPV does not include a move, a usable target-position evaluation may be used to estimate that move's loss.
- Move-quality bands use one grammar:
  - under `0.5` pawn loss: strong;
  - `0.5` to under `1.0`: dubious;
  - `1.0+`: bad.
- Missing engine source data remains unavailable/unknown rather than being interpreted as strong, dubious, or bad.

Constellation selection may consume already-available engine quality as an independent rescue signal for rare candidates. That consumer owns the consequence for eligibility and ranking; Evidence does not request engine acquisition on its behalf.

## Human evidence

- Rated Lichess Explorer is the primary practical population.
- Masters is a separate comparison population rather than a replacement for rated Explorer.
- Rated Explorer supplies Prevalence and game-result evidence for automatic Constellation selection.
- Human-result quality preserves at least three semantic states for selection consumers: favorable, unfavorable, and unknown/insufficient. Missing or failed requests remain unknown rather than becoming unfavorable.
- Exact favorable/unfavorable score thresholds and sample-sufficiency thresholds are tunable until separately promoted into durable requirements.
- Constellation selection may treat favorable human-result evidence as an independent rescue signal for a rare candidate. Evidence owns the signal; selection owns the eligibility consequence.
- Human/engine mismatch evidence is produced only when sufficiently sampled human results materially disagree with the engine signal.
- Failure to fetch Masters, rated Explorer, or engine source data must not be interpreted as evidence that no disagreement, evaluation, favorable result, unfavorable result, or other signal exists.

## Prevalence

**Prevalence** is evidence of how commonly a move occurs in the observed human population at its immediate source position. It includes game count and move share. Prevalence describes observed play; it does not decide whether ChessView should show the move.

- Rated Explorer move share is local to the move's immediate source position.
- Prevalence from different source positions is separate local evidence and is not, by itself, a globally comparable score across the Constellation.
- Missing or unusable rated Explorer Prevalence remains unknown/unavailable rather than being treated as zero share.

## Root rarity

Root rarity is separate from move quality.

- With meaningful human evidence, Root moves below 5% of games at their immediate source are rare.
- Root moves below 1% are very rare.
- Synthetic/manual zero-share edges and tiny source samples do not establish rarity.
- Missing, failed, or insufficient human evidence does not establish rarity.

## Tunables

Move-quality and Root-rarity thresholds are specified in their owning behavior sections above. Cloud-evaluation source-quality thresholds belong to `LichessEval`. Rail selection thresholds belong to [Rail](rail.md). Constellation rescue and Salience rules belong to [Constellation selection](constellation-selection.md).

## Verification

Deterministic tests should cover:

- move loss from source MultiPV and target-position fallback;
- the 0.5 / 1.0 pawn quality thresholds;
- unavailable engine source data remaining distinct from strong, dubious, or bad quality;
- already-available engine evidence remaining usable by selection without Evidence owning its acquisition;
- missing optional engine evidence remaining unknown without creating a structural Weather dependency;
- human-result quality preserving favorable, unfavorable, and unknown/insufficient states independently from Prevalence;
- human-result mismatch direction and sample gating;
- Root rarity thresholds and evidence gating;
- rated Explorer Prevalence remaining local to its source position;
- supplementary/background evidence completing, failing, or arriving late without blocking or reopening successful Weather.

`LichessEval` verification separately owns minimum source depth, absence versus provider issues, stale fallback, and request lifetime.

Manual verification should include positions with both common and rare Root and Line moves and positions where Masters, rated Lichess, and engine evidence disagree in useful ways. It should also confirm that failed supplementary source acquisition is surfaced as source activity/issue rather than silently becoming negative evidence while leaving an otherwise established Constellation globally settled.
