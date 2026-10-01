# Constellation selection

## Purpose

Own the eligibility and Salience rules used when automatic Constellation Candidates compete for limited visible space.

A **Candidate** is current-view selection state for one known [Graph Edge](../glossary.md#graph-edge) combined with currently available evidence. A Candidate is not a Graph Edge and is not persisted as `ChartedGraph` state.

This specification decides which Candidates remain in contention and how Candidates from the same source position are ordered. [Constellation](constellation.md) owns cross-branch allocation and the coherent subgraph ultimately selected for the current view.

## Inputs

Selection may use:

- one known Graph Edge;
- rated Lichess Explorer Prevalence at that Move's immediate source position;
- engine-quality evidence already available to the current composition;
- human-result evidence supplied by rated Explorer Readings;
- canonical graph identity needed to recognize transpositions.

[Evidence](evidence.md) owns the meaning, calculation, and unknown/unavailable state of quality, human-result, and Prevalence signals. Selection consumes those signals without redefining them.

Candidate-local eligibility, Salience, ranking order, or other current-view annotations must not be written back onto the Graph Edge. Likewise, Explorer games/share used for selection remain current source evidence rather than Graph Edge fields.

## Acquisition boundary

Selection is not an engine-acquisition frontier. It may consume usable engine evidence already available through `LichessEval.available()`, but it does not start cloud-evaluation acquisition solely because an unknown engine result could change eligibility, Salience, or constrained membership. Missing engine evidence remains unknown and does not keep the Constellation structurally unsettled.

Rated Explorer acquisition is different because an Explorer Reading is also graph-bearing knowledge: Constellation may request another Reading when additional outgoing graph knowledge can still change constrained composition. Human-result and Prevalence evidence that arrive with such a Reading may affect selection, but that does not turn optional cloud evaluation into a structural dependency.

## Eligibility

- Automatic Candidates are bounded by usable rated Lichess Explorer data. A Move with no usable Prevalence data there is outside automatic Constellation selection for now.
- Prevalence and quality are independent. A frequent Move remains eligible even when engine or human evidence is poor because users encounter it in practice.
- Rarity alone does not disqualify a Candidate. A rare Move remains significant when available engine quality or favorable human results provide a positive rescue signal.
- Rare Candidates whose available selection evidence establishes them as bad or unsuccessful, with no positive engine-quality or human-result rescue signal, are the first omission class when the Constellation must reduce what it shows.
- Missing, failed, insufficient, or otherwise unknown rescue evidence is not bad/unfavorable evidence and cannot establish that omission class on its own.
- Explicitly materialized graph knowledge may remain navigable even when it is outside automatic Constellation candidacy.

## Salience

Salience is the selection importance of an eligible Candidate: how strongly ChessView should prefer representing it relative to sibling alternatives. Salience may depend on Prevalence and other available selection evidence, but it is not itself a population statistic and is not a Graph Edge property.

## Ranking

- Same-source Salience starts from descending Prevalence order.
- Clear positive selection evidence — strong engine quality or favorable human-result evidence — promotes a Candidate by one local sibling place. Clear negative selection evidence — bad engine quality or unfavorable human-result evidence — demotes it by one local sibling place.
- Unknown evidence, neutral evidence, or conflicting positive and negative evidence does not adjust the Prevalence-derived order.
- A rare Candidate with known negative evidence and no positive rescue remains the first omission class and is ordered after otherwise eligible siblings when constrained space requires omission.
- These promotions and demotions are local ordinal adjustments, not percentages or globally comparable scores. They preserve Prevalence as independent observed evidence while allowing Salience to express what is more important to represent.
- Prevalence from different source positions is local evidence and does not define one global rank across unrelated branches or depths. [Constellation](constellation.md) owns how locally ordered Candidates compete for scarce space across the coherent view.
- Canonical transpositions are coalesced by graph identity before visible space is spent on duplicate positions.
- Constellation may omit lower-Salience eligible Candidates to preserve coherence and fit the available presentation space.

A fixed `5%` eligibility cutoff and a fixed `19`-board visibility limit are not product commitments of this algorithm. Concrete rarity, rescue, bad/unsuccessful evidence, evidence-sufficiency, and same-source Salience rules are tunable implementation choices unless separately promoted into durable requirements.

## Verification

Deterministic tests should cover:

- a Candidate retaining an unchanged Graph Edge while carrying current evidence/selection state separately;
- a frequent bad Move remaining eligible;
- a rare Move remaining significant when already-available engine evidence rescues it;
- a rare Move remaining significant when favorable human results rescue it without engine rescue;
- unknown, failed, or insufficient rescue evidence not being treated as bad/unfavorable evidence;
- selection not starting cloud-evaluation acquisition merely because unknown engine evidence could alter ranking or constrained membership;
- missing engine evidence not creating a structural settlement dependency;
- a rare Candidate with known negative evidence and no positive rescue being omitted before otherwise comparable Candidates;
- same-source Salience starting from Prevalence while positive/negative evidence can move a Candidate one local sibling place;
- unknown or conflicting evidence leaving same-source Salience in Prevalence order;
- Candidates from different source positions not being globally ordered solely by their local Prevalence;
- a Move without usable rated Lichess Explorer Prevalence remaining outside automatic selection;
- canonical transpositions not consuming duplicate visible-position capacity.
