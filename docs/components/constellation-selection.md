# Constellation selection

## Purpose

Own automatic Candidate eligibility and same-source Salience before Constellation composition spends limited visible space.

A **Candidate** is current-view selection state for one known [Graph Edge](../glossary.md#graph-edge) combined with currently available evidence. A Candidate is not a Graph Edge and is never persisted as `ChartedGraph` state.

Selection decides which automatic Candidates remain in contention and how siblings from the same source position are ordered. [Constellation](constellation.md) owns cross-branch allocation and the coherent subgraph ultimately selected for the current view.

## Inputs

Selection may use:

- one known Graph Edge;
- rated Lichess Explorer Prevalence at that Move's immediate source position;
- engine-quality evidence already available to the current composition;
- human-result evidence supplied by rated Explorer Readings.

[Evidence](evidence.md) owns the meaning, calculation, and unknown/unavailable state of quality, human-result, and Prevalence signals. Selection consumes those signals without redefining them.

Candidate-local eligibility, Salience, ranking order, or other current-view annotations must not be written back onto the Graph Edge. Explorer games/share used for selection likewise remain current source evidence rather than Graph Edge fields.

## Acquisition boundary

Selection is not an engine-acquisition frontier. It may consume usable engine evidence already available through `LichessEval.available()`, but it does not start cloud-evaluation acquisition solely because an unknown engine result could change eligibility, Salience, or constrained membership. Missing engine evidence remains unknown and does not keep the Constellation structurally unsettled.

Rated Explorer acquisition is different because an Explorer Reading is also graph-bearing knowledge. Constellation may request another Reading when additional outgoing graph knowledge can still change constrained composition. Human-result and Prevalence evidence arriving with that Reading may affect selection, but optional cloud evaluation remains outside structural settlement.

## Eligibility

- Automatic Candidates require usable rated Lichess Explorer Prevalence. Without it, a Move is outside automatic Constellation selection for now.
- Prevalence and quality are independent. A frequent Move remains eligible even when engine or human evidence is poor because users encounter it in practice.
- Rarity alone does not disqualify a Candidate. A rare Move remains significant when available engine quality or favorable human results provide a positive rescue signal.
- A rare Candidate with known bad/unfavorable evidence and no positive rescue is the first omission class when the Constellation must reduce what it shows.
- Missing, failed, insufficient, or otherwise unknown rescue evidence is not bad/unfavorable evidence and cannot establish that omission class on its own.

## Salience

Salience is the selection importance of an eligible Candidate relative to sibling alternatives from the same source position. It may depend on Prevalence and other available selection evidence, but it is neither a population statistic nor a Graph Edge property.

- Same-source Salience starts from descending Prevalence order.
- Clear positive selection evidence — strong engine quality or favorable human-result evidence — promotes a Candidate by one local sibling place. Clear negative evidence — bad engine quality or unfavorable human-result evidence — demotes it by one local sibling place.
- Unknown, neutral, or conflicting positive and negative evidence does not adjust the Prevalence-derived order.
- A rare Candidate with known negative evidence and no positive rescue remains the first omission class and is ordered after otherwise eligible siblings when constrained space requires omission.
- Promotions and demotions are local ordinal adjustments, not percentages or globally comparable scores.
- Prevalence from different source positions is local evidence and does not define one global rank across unrelated branches or depths.

[Constellation](constellation.md) owns how locally ordered Candidates compete across branches and how lower-Salience eligible Candidates may be omitted to preserve coherence and fit available presentation space.

A fixed `5%` eligibility cutoff is not a product commitment of this algorithm. Concrete rarity, rescue, bad/unsuccessful evidence, evidence-sufficiency, and same-source Salience rules are tunable implementation choices unless separately promoted into durable requirements.

## Output contract

Selection hands composition an already-admitted, already-ranked Candidate set. Downstream composition may allocate, merge, truncate, or arrange those Candidates to build a coherent Constellation, but it must not independently re-run automatic eligibility or require a second admission flag on the Graph Edge or Candidate projection.

Explicitly materialized navigation remains a separate product behavior: `explicit` may keep known graph relationships navigable even when automatic selection would not admit them. That durable graph property is an input to navigation/selection behavior, not a replacement eligibility protocol.

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
- downstream composition accepting the selected/ranked Candidate set without consulting a second eligibility marker.
