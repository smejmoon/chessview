# Evidence

## Purpose

Own how Chessview turns engine and human statistical data into semantic evidence signals such as move quality, human-result quality, mismatch, Prevalence, and Root rarity.

Evidence owns the meaning, calculation, and epistemic state of those signals. Consumers such as [Constellation selection](constellation-selection.md), [Rail](rail.md), and [Interface](interface.md) own how those signals affect eligibility, navigation, or presentation.

Source clients own whether source data is fit to expose. In particular, [`LichessEval`](../architecture/lichess-eval.md), rated Explorer, and Masters own source acquisition, validation, cache/freshness policy, fallback, and operational status. Evidence consumes only currently usable observations or absence.

## Projection boundary

Evidence derivation is a projection over facts already available for the current Nodus. It may read provider-current observations and durable cached observations, but it does not initiate Explorer, cloud-evaluation, or Masters acquisition and does not subscribe to source notifications.

Run-owned source work is planned outside Evidence. When that work settles, [Current view](../architecture/current-view.md) recomputes the Nodus and Evidence derives replacement immutable signals from the facts now available. Missing facts remain unknown while work is pending or unavailable; an established Evidence value remains usable until a replacement is accepted.

This separation prevents transport or hydration state from becoming chess meaning. Provider persistence failure may still leave a fresh provider-current observation usable by the next settlement pass.

## Product criticality

Evidence is not structural or supplementary solely because of its source. Criticality follows how the current view uses it.

Rated Explorer is graph-bearing when another Reading can still change constrained Constellation structure; Constellation expresses that need through its Reading frontier. Prevalence and human-result evidence from an already available Reading may immediately affect selection.

Cloud evaluation does not become a structural prerequisite merely because engine evidence can influence ranking. When no usable engine value is currently available, the engine signal remains unknown. Current-view refinement may still nominate cloud evaluation for richer Rail/Evidence output; its failure does not invalidate established structure.

Masters is a separate comparison population and likewise refines evidence when usable. Unavailable evidence remains unknown rather than negative chess evidence. Provider operational issues remain in provider operational channels; they are not encoded as unfavorable result, no mismatch, or zero Prevalence.

## Engine evidence

- Evidence receives only cloud evaluations that `LichessEval` considers usable.
- The current center position has an absolute-evaluation signal when usable engine source data exists.
- Root and Line moves have a move-loss signal versus the best move rather than inheriting the target's absolute evaluation directly.
- When source MultiPV does not include a move, a usable target-position evaluation may estimate that move's loss.
- Move-quality bands use one grammar:
  - under `0.5` pawn loss: strong;
  - `0.5` to under `1.0`: dubious;
  - `1.0+`: bad.
- Missing engine source data remains unavailable/unknown rather than being interpreted as strong, dubious, or bad.

Constellation selection may consume already-available engine quality as an independent rescue signal for rare candidates. That consumer owns the consequence for eligibility/ranking; Evidence does not request engine acquisition on its behalf.

## Human evidence

- Rated Lichess Explorer is the primary practical population.
- Masters is a separate comparison population rather than a replacement for rated Explorer.
- Rated Explorer supplies Prevalence and game-result evidence for automatic Constellation selection.
- Human-result quality preserves favorable, unfavorable, and unknown/insufficient states. Missing or failed requests remain unknown rather than unfavorable.
- Exact favorable/unfavorable score thresholds and sample-sufficiency thresholds are implementation tunables unless separately promoted into durable requirements.
- Constellation selection may treat favorable human-result evidence as an independent rescue signal for a rare candidate. Evidence owns the signal; selection owns the eligibility consequence.
- Human/engine mismatch is produced only when sufficiently sampled human results materially disagree with the engine signal.
- Failure to obtain Masters, rated Explorer, or engine data must not be interpreted as evidence that no disagreement, evaluation, favorable result, unfavorable result, or other signal exists.

## Prevalence

**Prevalence** is evidence of how commonly a move occurs in the observed human population at its immediate source position. It includes game count and move share. Prevalence describes observed play; it does not decide whether Chessview should show the move.

- Rated Explorer move share is local to the move's immediate source position.
- Prevalence from different source positions is separate local evidence and is not by itself a globally comparable score across the Constellation.
- Missing or unusable rated Explorer Prevalence remains unknown/unavailable rather than zero share.

## Root rarity

Root rarity is separate from move quality.

- With meaningful human evidence, Root moves below 5% of games at their immediate source are rare.
- Root moves below 1% are very rare.
- Synthetic/manual zero-share edges and tiny source samples do not establish rarity.
- Missing, failed, or insufficient human evidence does not establish rarity.

## Tunables

Move-quality and Root-rarity thresholds are specified in their owning behavior sections above. Cloud-evaluation source-quality thresholds belong to `LichessEval`. Rail behavior belongs to [Rail](rail.md). Constellation rescue and Salience rules belong to [Constellation selection](constellation-selection.md).

## Verification

Deterministic tests should cover:

- move loss from source MultiPV and target-position fallback;
- the 0.5 / 1.0 pawn quality thresholds;
- unavailable engine source data remaining distinct from strong, dubious, or bad quality;
- Evidence derivation performing no source acquisition side effect;
- newly available source facts appearing after current-view settlement recomputes Evidence;
- missing optional engine/Masters data remaining unknown without invalidating established structure;
- human-result quality preserving favorable, unfavorable, and unknown/insufficient states independently from Prevalence;
- human-result mismatch direction and sample gating;
- Root rarity thresholds and evidence gating;
- rated Explorer Prevalence remaining local to its source position;
- provider-current fresh observations remaining usable for Evidence even if local persistence failed;
- source failure or late completion leaving established Nodus/Evidence usable while provider operational state remains separate.

`LichessEval` verification separately owns minimum source depth, authoritative absence versus provider issues, stale fallback, persistence failure, and request lifetime.
