# Evidence

## Purpose

Own how Chessview turns currently available engine and human statistical observations into semantic evidence signals such as move quality, human-result quality, mismatch, Prevalence, Root rarity, and position evaluation.

Evidence owns the meaning, calculation, and epistemic state of those signals. It is independently addressable by canonical position or Graph Edge. Evidence does **not** require a Constellation, visible relationship, Rail row, or presentation object to exist before it can answer.

Consumers such as [Constellation selection](constellation-selection.md), [Rail](rail.md), and [Interface](interface.md) request the Evidence they need for a position or Graph Edge. Those consumers own how the returned signals affect eligibility, navigation, composition, or presentation.

Source clients own whether source data is fit to expose. In particular, [`LichessEval`](../architecture/lichess-eval.md), rated Explorer, and Masters own source acquisition, validation, cache/freshness policy, fallback, and operational status. Evidence consumes only currently usable observations or absence.

## Read boundary

Evidence is a semantic read boundary over facts already available. A read may ask for:

- whether a usable rated Explorer Reading is currently available for a canonical position;
- position-level Evidence such as usable engine evaluation;
- move-level Evidence for one Graph Edge, including Prevalence, move loss/quality, human-result quality, mismatch, and Root rarity.

Evidence reads may combine multiple currently available sources to derive one semantic signal, but they do not start Explorer, cloud-evaluation, or Masters acquisition, reconcile graph knowledge, subscribe to source notifications, or decide whether missing data is structurally required.

A consumer may request Evidence before any Constellation exists. Conversely, a later Constellation, Rail, or Interface derivation may request the same position/edge Evidence again after source facts become richer. Missing facts remain unknown rather than being encoded as negative evidence.

View-specific joining is outside Evidence. For example, presentation may join independently read move Evidence onto the IDs of currently visible Constellation relationships, but Evidence itself neither receives nor knows those relationship IDs or the Constellation structure.

## Product criticality

Evidence is not structural or supplementary solely because of its source. Criticality follows how a consumer uses it.

Rated Explorer is graph-bearing when another Reading can still change constrained Constellation structure. Constellation asks Evidence whether rated Reading evidence is available and expresses an admitted structural need through its Reading frontier when another Reading can still change shape. Prevalence and human-result Evidence returned for a Graph Edge may immediately affect Candidate selection.

Missing cloud evaluation is not a structural obligation merely because engine evidence can influence ranking. When no usable engine value is currently available, the engine signal remains unknown. Engine Evidence already available when Constellation derives may affect selection; supplementary cloud-evaluation acquisition may still make later Evidence richer, but its completion does not by itself reopen an otherwise Settled Constellation.

Masters is a separate comparison population and likewise provides supplementary evidence when usable. Unavailable Evidence remains unknown rather than negative chess evidence. Provider operational issues remain in provider operational channels; they are not encoded as unfavorable result, no mismatch, or zero Prevalence.

## Engine evidence

- Evidence receives only cloud evaluations that `LichessEval` considers usable.
- A canonical position has an absolute-evaluation signal when usable engine source data exists.
- A Graph Edge has a move-loss signal versus the best move rather than inheriting the target's absolute evaluation directly.
- When source MultiPV does not include a move, a usable target-position evaluation may estimate that move's loss.
- Move-quality bands use one grammar:
  - under `0.5` pawn loss: strong;
  - `0.5` to under `1.0`: dubious;
  - `1.0+`: bad.
- Missing engine source data remains unavailable/unknown rather than being interpreted as strong, dubious, or bad.

Constellation selection may consume engine quality as an independent rescue signal for rare candidates. That consumer owns the consequence for eligibility/ranking; Evidence does not request engine acquisition on its behalf.

## Human evidence

- Rated Lichess Explorer is the primary practical population.
- Masters is a separate comparison population rather than a replacement for rated Explorer.
- Rated Explorer supplies Prevalence and game-result Evidence for automatic Constellation selection.
- Human-result quality preserves favorable, unfavorable, and unknown/insufficient states. Missing or failed requests remain unknown rather than unfavorable.
- Exact favorable/unfavorable score thresholds and sample-sufficiency thresholds are implementation tunables unless separately promoted into durable requirements.
- Constellation selection may treat favorable human-result Evidence as an independent rescue signal for a rare Candidate. Evidence owns the signal; selection owns the eligibility consequence.
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

- position and Graph Edge Evidence being readable without any Constellation structure;
- Evidence having no dependency on Constellation, visible relationship identity, or presentation objects;
- Constellation requesting Evidence rather than directly calculating evidence semantics or reading engine/Explorer provider clients for Candidate evidence;
- move loss from source MultiPV and target-position fallback;
- the 0.5 / 1.0 pawn quality thresholds;
- unavailable engine source data remaining distinct from strong, dubious, or bad quality;
- Evidence reads performing no source acquisition or graph-reconciliation side effect;
- newly available source facts appearing in later Evidence reads without generic source completion defining structural settlement;
- missing optional engine/Masters data remaining unknown without invalidating established structure;
- late supplementary engine/Masters facts making later Evidence richer without reopening an otherwise Settled Constellation;
- human-result quality preserving favorable, unfavorable, and unknown/insufficient states independently from Prevalence;
- human-result mismatch direction and sample gating;
- Root rarity thresholds and evidence gating;
- rated Explorer Prevalence remaining local to its source position;
- provider-current fresh observations taking precedence over older durable observations for the current application lifetime;
- source failure leaving existing graph/navigation state usable while provider operational state remains separate.

`LichessEval` verification separately owns minimum source depth, authoritative absence versus provider issues, stale fallback, persistence failure, and request lifetime.
