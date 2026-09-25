# Evidence

## Purpose

Own how Chessview turns engine and human statistical data into move-quality, mismatch, Rail-selection, and Root-rarity signals.

## Engine evidence

- Cached Lichess cloud evaluation is used only when it reaches adequate depth.
- The current center position shows absolute evaluation.
- Root and Line moves show pawn loss versus the best move rather than absolute evaluation.
- When source MultiPV does not include a move, a sufficiently deep target-position evaluation may be used to estimate that move's loss.
- Move-quality bands use one grammar:
  - under `0.5` pawn loss: strong;
  - `0.5` to under `1.0`: dubious;
  - `1.0+`: bad.

## Human evidence

- Rated Lichess Explorer is the primary practical population.
- Masters is a separate comparison population rather than a replacement for rated Explorer.
- Human-result markers appear only when sufficiently sampled human results materially disagree with the engine signal.
- Failure to fetch Masters or engine evidence must not be interpreted as evidence that no disagreement or evaluation exists.

## Rail selection

- The Rail keeps sufficiently sampled plausible moves even when they are unpopular.
- Manual/explicitly explored moves remain eligible for navigation.
- Engine-bad or human-bad moves are normally suppressed.
- Popular mistakes above 5% remain selectable even when bad.

## Root rarity

Root rarity is separate from move quality and does not reuse the green/amber/red quality grammar.

- With meaningful human evidence, Root moves below 5% of games at their immediate source are rare.
- Root moves below 1% are very rare.
- Synthetic/manual zero-share edges and tiny source samples do not establish rarity.
- Rarity presentation may use a diamond, reduced emphasis, and dashed connectors; the stronger treatment applies to very rare Roots.

## Tunables

- Engine display minimum depth: `18`.
- Rail human-sample floor: `100` games.
- Dubious threshold: `0.5` pawn loss.
- Bad threshold: `1.0` pawn loss.
- Popular-bad Rail retention threshold: `0.05`.
- Rare Root threshold: below `0.05`.
- Very-rare Root threshold: below `0.01`, with meaningful source evidence and observed move games.

## Verification

Deterministic tests should cover:

- minimum eval depth;
- move loss from source MultiPV and target-position fallback;
- the 0.5 / 1.0 pawn quality thresholds;
- human-result mismatch direction and sample gating;
- Rail-worthy filtering and popular-bad retention;
- Root rarity thresholds and evidence gating;
- request-failure values remaining distinct from genuine missing evidence.

Manual verification should include positions with both common and rare Root move orders and positions where Masters, rated Lichess, and engine evidence disagree in useful ways.
