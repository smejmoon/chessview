# Constellation selection

## Purpose

Own the eligibility and Salience rules used when automatic Constellation candidates compete for limited visible space.

This specification decides which candidates remain in contention and how candidates from the same source position are ordered. [Constellation](constellation.md) owns cross-branch allocation and the coherent subgraph ultimately selected for the current view.

## Inputs

Selection may use:

- rated Lichess Explorer Prevalence at the candidate move's immediate source position;
- engine-quality evidence already available to the current composition;
- human-result evidence supplied by rated Explorer Readings;
- canonical graph identity needed to recognize transpositions.

[Evidence](evidence.md) owns the meaning, calculation, and unknown/unavailable state of quality, human-result, and Prevalence signals. Selection consumes those signals without redefining them.

## Acquisition boundary

Selection is not an engine-acquisition frontier. It may consume usable engine evidence already available through `LichessEval.available()`, but it does not start cloud-evaluation acquisition solely because an unknown engine result could change eligibility, Salience, or constrained membership. Missing engine evidence remains unknown and does not keep the Constellation structurally unsettled.

Rated Explorer acquisition is different because an Explorer Reading is also graph-bearing knowledge: Constellation may request another Reading when additional outgoing graph knowledge can still change constrained composition. Human-result and Prevalence evidence that arrive with such a Reading may affect selection, but that does not turn optional cloud evaluation into a structural dependency.

## Eligibility

- Automatic candidates are bounded by usable rated Lichess Explorer data. A move with no usable Prevalence data there is outside automatic Constellation selection for now.
- Prevalence and quality are independent. A frequent move remains eligible even when engine or human evidence is poor because users encounter it in practice.
- Rarity alone does not disqualify a move. A rare move remains significant when available engine quality or favorable human results provide a positive rescue signal.
- Rare candidates whose available selection evidence establishes them as bad or unsuccessful, with no positive engine-quality or human-result rescue signal, are the first omission class when the Constellation must reduce what it shows.
- Missing, failed, insufficient, or otherwise unknown rescue evidence is not bad/unfavorable evidence and cannot establish that omission class on its own.
- Explicit/manual graph knowledge may remain navigable even when it is outside automatic Constellation candidacy.

## Salience

Salience is the selection importance of an eligible candidate: how strongly ChessView should prefer representing it relative to sibling alternatives. Salience may depend on Prevalence and other available selection evidence, but it is not itself a population statistic.

## Ranking

- Same-source Salience starts from descending Prevalence order.
- Clear positive selection evidence — strong engine quality or favorable human-result evidence — promotes a candidate by one local sibling place. Clear negative selection evidence — bad engine quality or unfavorable human-result evidence — demotes it by one local sibling place.
- Unknown evidence, neutral evidence, or conflicting positive and negative evidence does not adjust the Prevalence-derived order.
- A rare candidate with known negative evidence and no positive rescue remains the first omission class and is ordered after otherwise eligible siblings when constrained space requires omission.
- These promotions and demotions are local ordinal adjustments, not percentages or globally comparable scores. They preserve Prevalence as independent observed evidence while allowing Salience to express what is more important to represent.
- Prevalence from different source positions is local evidence and does not define one global rank across unrelated branches or depths. [Constellation](constellation.md) owns how locally ordered candidates compete for scarce space across the coherent view.
- Canonical transpositions are coalesced by graph identity before visible space is spent on duplicate positions.
- Constellation may omit lower-Salience eligible candidates to preserve coherence and fit the available presentation space.

A fixed `5%` eligibility cutoff and a fixed `19`-board visibility limit are not product commitments of this algorithm. Concrete rarity, rescue, bad/unsuccessful evidence, evidence-sufficiency, and same-source Salience rules are tunable implementation choices unless separately promoted into a durable requirement.

## Verification

Deterministic tests should cover:

- a frequent bad move remaining eligible;
- a rare move remaining significant when already-available engine evidence rescues it;
- a rare move remaining significant when favorable human results rescue it without engine rescue;
- unknown, failed, or insufficient rescue evidence not being treated as bad/unfavorable evidence;
- selection not starting cloud-evaluation acquisition merely because unknown engine evidence could alter ranking or constrained membership;
- missing engine evidence not creating a structural settlement dependency;
- a rare move with known bad/unsuccessful evidence and no positive rescue being omitted before otherwise comparable candidates;
- same-source Salience starting from Prevalence while positive/negative evidence can move a candidate one local sibling place;
- unknown or conflicting evidence leaving same-source Salience in Prevalence order;
- candidates from different source positions not being globally ordered solely by their local Prevalence;
- a move without usable rated Lichess Explorer Prevalence remaining outside automatic selection;
- canonical transpositions not consuming duplicate visible-position capacity.
