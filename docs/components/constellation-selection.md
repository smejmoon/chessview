# Constellation selection

## Purpose

Own the eligibility and comparable-candidate ordering rules used when automatic Constellation candidates compete for limited visible space.

This specification decides which candidates remain in contention and how candidates from the same source position are ordered. [Constellation](constellation.md) owns cross-branch allocation and the coherent subgraph ultimately selected for the current view.

## Inputs

Selection may use:

- rated Lichess Explorer frequency at the candidate move's immediate source position;
- engine-quality evidence;
- human-result evidence;
- canonical graph identity needed to recognize transpositions.

[Evidence](evidence.md) owns the meaning, calculation, and unknown/unavailable state of quality, human-result, and frequency signals. Selection consumes those signals without redefining them.

## Eligibility

- Automatic candidates are bounded by usable rated Lichess Explorer data. A move with no usable human-frequency data there is outside automatic Constellation selection for now.
- Frequency and quality are independent. A frequent move remains eligible even when engine or human evidence is poor because users encounter it in practice.
- Rarity alone does not disqualify a move. A rare move remains eligible when either engine quality or favorable human results make it significant.
- Rare candidates whose available selection evidence establishes them as bad or unsuccessful, with no positive engine-quality or human-result rescue signal, are the first omission class when the Constellation must reduce what it shows.
- Missing, failed, insufficient, or otherwise unknown rescue evidence is not bad/unfavorable evidence and cannot establish that omission class on its own.
- Explicit/manual graph knowledge may remain navigable even when it is outside automatic Constellation candidacy.

## Ranking

- Among eligible automatic candidates that share the same immediate source position, rated Lichess Explorer frequency orders candidates highest first.
- In that same-source comparison, frequency wins when a frequent bad move competes with a rarer good move. Quality and human-result evidence rescue rare candidates from automatic omission; they do not override frequency as the primary local ordering rule.
- Explorer percentages from different source positions are local evidence and do not define one global rank across unrelated branches or depths. [Constellation](constellation.md) owns how locally ordered candidates compete for scarce space across the coherent view.
- Canonical transpositions are coalesced by graph identity before visible space is spent on duplicate positions.
- Constellation may omit lower-priority eligible candidates to preserve coherence and fit the available presentation space.

A fixed `5%` eligibility cutoff and a fixed `19`-board visibility limit are not product commitments of this algorithm. Concrete rarity, rescue, bad/unsuccessful evidence, evidence-sufficiency, and same-source tie-breaking thresholds are tunable implementation choices unless separately promoted into a durable requirement.

## Verification

Deterministic tests should cover:

- a frequent bad move remaining eligible;
- a rare move remaining eligible when engine evidence rescues it;
- a rare move remaining eligible when favorable human results rescue it without engine rescue;
- unknown, failed, or insufficient rescue evidence not being treated as bad/unfavorable evidence;
- a rare move with known bad/unsuccessful evidence and no positive rescue being omitted before otherwise comparable rescued candidates;
- a frequent bad move ranking ahead of a rarer good move when both share the same immediate source position;
- candidates from different source positions not being globally ordered solely by their local Explorer percentages;
- a move without usable rated Lichess Explorer frequency remaining outside automatic selection;
- canonical transpositions not consuming duplicate visible-position capacity.
