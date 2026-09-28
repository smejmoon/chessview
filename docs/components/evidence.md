# Evidence

## Purpose

Own how Chessview turns engine and human statistical data into semantic evidence signals such as move quality, human-result quality, mismatch, frequency, and Root rarity.

Evidence owns the meaning, calculation, and epistemic state of those signals. Consumers such as [Constellation selection](constellation-selection.md), [Rail](rail.md), and [Interface](interface.md) own how those signals affect eligibility, navigation, or presentation.

## Product criticality

Evidence is not critical or supplementary solely because of its source. Criticality follows how the current view uses it.

Evidence explicitly required to decide the current Constellation's structural membership or ordering is part of critical structural work for that decision. Evidence used only to annotate an already established Constellation or enrich the Rail is supplementary and may continue hydrating without blocking normal Weather.

Rated Lichess Explorer frequency used by Constellation selection is structural input. Engine and human-result evidence may also become structural input when Constellation selection requests them to decide whether a rare candidate remains eligible. The same engine or human evidence remains supplementary when it is used only for labels, colors, mismatch markers, rarity treatment, or Rail enrichment.

Failure of supplementary evidence reduces richness rather than structural usability. Request failure must remain distinguishable from genuine absence at the local evidence surface, but it must not by itself reopen Weather or remove the normal settled check from a structurally established view.

## Engine evidence

- Cached Lichess cloud evaluation is used only when it reaches adequate depth.
- The current center position has an absolute-evaluation signal.
- Root and Line moves have a move-loss signal versus the best move rather than inheriting the target's absolute evaluation directly.
- When source MultiPV does not include a move, a sufficiently deep target-position evaluation may be used to estimate that move's loss.
- Move-quality bands use one grammar:
  - under `0.5` pawn loss: strong;
  - `0.5` to under `1.0`: dubious;
  - `1.0+`: bad.
- Missing, failed, or insufficient-depth engine evidence remains unavailable/unknown rather than being interpreted as strong, dubious, or bad.

Constellation selection may consume engine quality as an independent rescue signal for rare candidates. That consumer owns the consequence for eligibility and ranking.

## Human evidence

- Rated Lichess Explorer is the primary practical population.
- Masters is a separate comparison population rather than a replacement for rated Explorer.
- Rated Explorer supplies human-frequency and game-result evidence for automatic Constellation selection.
- Human-result quality preserves at least three semantic states for selection consumers: favorable, unfavorable, and unknown/insufficient. Missing or failed requests remain unknown rather than becoming unfavorable.
- Exact favorable/unfavorable score thresholds and sample-sufficiency thresholds are tunable until separately promoted into durable requirements.
- Constellation selection may treat favorable human-result evidence as an independent rescue signal for a rare candidate. Evidence owns the signal; selection owns the eligibility consequence.
- Human/engine mismatch evidence is produced only when sufficiently sampled human results materially disagree with the engine signal.
- Failure to fetch Masters, rated Explorer, or engine evidence must not be interpreted as evidence that no disagreement, evaluation, favorable result, unfavorable result, or other signal exists.
- When no stale evidence is available, evidence state distinguishes request failure from genuine missing, insufficient-depth, insufficient-sample, or no-mismatch outcomes.

## Frequency evidence

- Rated Explorer move share is local to the move's immediate source position.
- Shares from different source positions are separate local evidence and are not, by themselves, a globally comparable score across the Constellation.
- Missing or unusable rated Explorer frequency remains unknown/unavailable rather than being treated as zero share.

## Root rarity

Root rarity is separate from move quality.

- With meaningful human evidence, Root moves below 5% of games at their immediate source are rare.
- Root moves below 1% are very rare.
- Synthetic/manual zero-share edges and tiny source samples do not establish rarity.
- Missing, failed, or insufficient human evidence does not establish rarity.

## Tunables

- Engine evidence minimum depth: `18`.

Move-quality and Root-rarity thresholds are specified in their owning behavior sections above. Rail selection thresholds belong to [Rail](rail.md). Constellation rescue and ranking thresholds belong to [Constellation selection](constellation-selection.md).

## Verification

Deterministic tests should cover:

- minimum eval depth;
- move loss from source MultiPV and target-position fallback;
- the 0.5 / 1.0 pawn quality thresholds;
- unavailable/failed engine evidence remaining distinct from strong, dubious, or bad quality;
- human-result quality preserving favorable, unfavorable, and unknown/insufficient states independently from frequency;
- human-result mismatch direction and sample gating;
- Root rarity thresholds and evidence gating;
- rated Explorer frequency remaining local to its source position;
- request-failure values remaining distinct from genuine missing or insufficient evidence;
- supplementary evidence completing, failing, or arriving late without blocking or reopening successful Weather when it is not a pending Constellation-selection dependency.

Manual verification should include positions with both common and rare Root and Line moves and positions where Masters, rated Lichess, and engine evidence disagree in useful ways. It should also confirm that failed supplementary requests show an unavailable state rather than silently becoming negative evidence while leaving an otherwise established Constellation globally settled.
