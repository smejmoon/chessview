# Constellation selection

## Purpose

Own automatic Candidate eligibility and same-source Salience before Constellation composition spends limited visible space.

A **Candidate** is current-view selection state for one known [Graph Edge](../glossary.md#graph-edge) combined with currently available evidence. A Candidate is not a Graph Edge and is never persisted as `ChartedGraph` state.

Selection decides which automatic Candidates remain in contention and how siblings from the same source position are ordered. Its output is the selected Candidate sequence in that same-source Salience order. [Constellation](constellation.md) owns cross-branch allocation and the coherent subgraph ultimately selected for the current view.

Explicitly materialized navigation is separate. A Graph Edge may remain navigable because it is `explicit` even when there is no current Candidate for it.

## Inputs

Selection may use:

- one known Graph Edge;
- rated Lichess Explorer Prevalence at that Move's immediate source position;
- engine-quality evidence already admitted to the current composition;
- human-result evidence supplied by rated Explorer Readings.

[Evidence](evidence.md) owns the meaning, calculation, and unknown/unavailable state of quality, human-result, and Prevalence signals. Selection consumes those signals without redefining them.

Candidate-local eligibility, Salience, ranking order, or other current-view annotations must not be written back onto the Graph Edge. Explorer games/share used for selection likewise remain current source evidence rather than Graph Edge fields.

## Acquisition boundary

Selection is not an engine-acquisition frontier. Engine evidence already admitted to a composition may affect eligibility, Salience, or constrained membership, but selection does not start cloud-evaluation acquisition solely because an unknown engine result could change those decisions. Missing engine evidence remains unknown and does not create a structural settlement obligation.

A supplementary cloud-evaluation completion does not by itself reopen or recompose an otherwise [Settled](../glossary.md#settled) Constellation. If composition is later required for an independently admitted structural reason, engine evidence then available may be admitted to that new composition and affect selection.

Rated Explorer acquisition is different because an Explorer Reading is also graph-bearing knowledge. Constellation may admit another Reading as a structural obligation while additional outgoing graph knowledge can still change constrained composition. Human-result and Prevalence evidence arriving with that Reading may affect selection, but optional cloud evaluation remains outside structural settlement.

Evidence already obtained from Lichess is treated as the current source snapshot for selection. The snapshot may be partial: usable Explorer Prevalence may exist while optional engine evidence is unavailable. Missing optional evidence changes no ordering by itself and does not trigger compensating acquisition or remembered ranking state.

Explicit materialization does not itself trigger Candidate-specific Explorer acquisition. If current source evidence is already available, an explicit Graph Edge participates in selection exactly like any other Graph Edge. If usable Prevalence is unavailable, there is no Candidate; the durable explicit relationship remains navigable through the navigation surfaces that own that behavior.

## Eligibility

- Candidates require usable rated Lichess Explorer Prevalence. Without it, a Move is outside automatic Constellation selection for now.
- `explicit` does not bypass this requirement and does not change the meaning of Candidate evidence.
- Prevalence and quality are independent. A frequent Move remains eligible even when engine or human evidence is poor because users encounter it in practice.
- Rarity alone does not disqualify a Candidate. A rare Move remains significant when available engine quality or favorable human results provide a positive rescue signal.
- A rare Candidate with known bad/unfavorable evidence and no positive rescue is the first omission class when the Constellation must reduce what it shows.
- Missing, failed, insufficient, or otherwise unknown rescue evidence is not bad/unfavorable evidence and cannot establish that omission class on its own.

## Salience

Salience is the selection importance of an eligible Candidate relative to sibling alternatives from the same source position. It may depend on Prevalence and other available selection evidence, but it is neither a population statistic nor a Graph Edge property.

- Same-source Salience starts from descending Prevalence order.
- Clear positive selection evidence — strong engine quality or favorable human-result evidence — promotes a Candidate by at most one local sibling place among otherwise ordinary Candidates.
- Negative evidence does not ordinarily demote a Candidate from its Prevalence position. Frequent bad/unfavorable Moves remain structurally important because users encounter them in practice.
- Unknown, neutral, or conflicting positive and negative evidence does not adjust the Prevalence-derived order.
- A rare Candidate with known negative evidence and no positive rescue is a separate first-omission class and is ordered after otherwise eligible siblings when constrained space requires omission. Within that class, Prevalence order is preserved.
- Positive promotion is a local ordinal adjustment, not a percentage or globally comparable score.
- Prevalence from different source positions is local evidence and does not define one global rank across unrelated branches or depths.

[Constellation](constellation.md) owns how locally ordered Candidates compete across branches and how lower-Salience eligible Candidates may be omitted to preserve coherence and fit available presentation space.

`5%` is the current rarity threshold, not an automatic eligibility cutoff. Rarity, rescue, negative-evidence, evidence-sufficiency, and same-source Salience behavior are current component rules. Their thresholds and details may evolve, but changes must update this contract and its verification rather than being treated as implementation-only choices.

## Output contract

Selection hands composition the selected Candidate objects themselves, already admitted and sequenced in same-source Salience order. Position in that sequence is the downstream same-source ordering contract. Composition may allocate, merge, truncate, or arrange those Candidates to build a coherent Constellation, but it must not independently re-run automatic eligibility, re-rank same-source Candidates, or require copied admission/order markers on the Graph Edge or on an edge-shaped projection.

A selected Candidate may retain evidence or selection metadata when another current-view consumer needs it, but composition must not require duplicate admission or ordering state to rediscover decisions already made by selection.

Explicit navigation is not part of this output contract. The durable `explicit` Graph Edge property belongs to navigation behavior; it neither manufactures an evidence-free Candidate nor guarantees Constellation space. When an explicit Graph Edge also has usable current Prevalence, the same Graph Edge may independently appear in the ordinary selected Candidate sequence.

## Verification

Deterministic tests should cover:

- a Candidate retaining an unchanged Graph Edge while carrying current evidence/selection state separately;
- a frequent bad Move remaining eligible and retaining its Prevalence priority rather than receiving an ordinary negative demotion;
- a rare Move remaining significant when engine evidence already admitted to the composition rescues it;
- a rare Move remaining significant when favorable human results rescue it without engine rescue;
- unknown, failed, or insufficient rescue evidence not being treated as bad/unfavorable evidence;
- selection not starting cloud-evaluation acquisition merely because unknown engine evidence could alter ranking or constrained membership;
- missing engine evidence not creating a structural settlement obligation or changing the Prevalence baseline;
- late supplementary cloud evaluation not reopening or recomposing a Settled Constellation by itself;
- a rare Candidate with known negative evidence and no positive rescue being omitted before otherwise comparable Candidates;
- same-source Salience starting from Prevalence while clear positive evidence can promote a Candidate by at most one local sibling place among ordinary Candidates;
- multiple positive promotions remaining local without cascading a Candidate more than one sibling place;
- unknown, negative-only, or conflicting evidence leaving ordinary same-source Salience in Prevalence order;
- Candidates from different source positions not being globally ordered solely by their local Prevalence;
- a Move without usable rated Lichess Explorer Prevalence producing no Candidate, including when its Graph Edge is explicit;
- an explicit Graph Edge with usable current Prevalence producing the same evidence-backed Candidate semantics as an otherwise equivalent non-explicit Graph Edge;
- explicit-only navigation remaining available independently of Candidate/Constellation membership;
- downstream composition accepting selected Candidate objects in selection order without consulting a second eligibility or same-source ordering marker.
