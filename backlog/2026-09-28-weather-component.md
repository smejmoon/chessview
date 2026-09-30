# Do:

Make structural readiness/lifecycle behavior satisfy `docs/components/weather.md` §Requirements and the current-view acceptance rules in `docs/architecture/current-view.md` §Publication boundary while preserving the Progressive truth principle in `docs/vision.md` §Experience principles. A trustworthy provisional Constellation must remain visible and navigable while unresolved structural work can still improve it; `Updating…` reports that unsettled refinement rather than acting as a publication gate. Preserve generation-scoped settlement, degraded failure when no trustworthy current structure can be established, and the delayed `Updating…` → brief `Ready` → settled-check acknowledgement.

Keep supplementary evidence from controlling global Weather unless it is an unresolved Constellation-selection dependency. When structurally relevant acquisition/evidence fails after a trustworthy Constellation is already published, settle that dependency as failed/unknown as appropriate without discarding the trustworthy structure. Allow practical debounce/coalescing of transient status or recomposition updates to reduce distracting fidgeting without presenting an unsettled view as settled.

The outcome does not require a separate Weather module if the existing implementation can provide one testable owner of these semantics without duplicated truth.

# Because:

`docs/components/weather.md` §Purpose / §Requirements owns current-view structural lifecycle/readiness semantics and now explicitly permits trustworthy structure to remain visible during refinement. `docs/product.md` §Product usability bar distinguishes a usable published view from a settled view. `docs/architecture/current-view.md` §Publication boundary owns which asynchronous results may become current. `docs/components/evidence.md` §Product criticality distinguishes evidence that is structural for selection from evidence that is only supplementary.

# Edges:

`docs/components/constellation.md` §Requirements determines the visible structural result and which unresolved information can still improve it; Weather reports whether that refinement remains structurally unsettled. `docs/components/evidence.md` §Product criticality keeps annotation-only evidence supplementary, while evidence explicitly required to decide current Constellation membership/order is structural for that decision. `docs/product.md` §Weather owns the cross-product meaning of the global states.

Current-view publication and Weather settlement are separate decisions: a current-generation structural value may be accepted and published before all structural dependencies settle. Obsolete-generation completion must still be rejected by the current-view boundary.

# Unsettled:

Choose the smallest Weather state/value interface that distinguishes usable-but-updating from settled and degraded without exposing controller revision tokens or duplicating lifecycle truth. A new code module is optional unless it is the simplest way to satisfy the durable ownership boundary.

Decide how pending Constellation-selection acquisition/evidence dependencies participate in Weather settlement and reach terminal results when information is unavailable, without treating transport failure, missing data, or insufficient evidence as negative chess evidence or invalidating trustworthy structure already published.

Keep or adjust the existing presentation delay/acknowledgement and recomposition-coalescing behavior only after verifying the current UX. Practical anti-fidgeting may delay or combine transient updates, but must preserve a perceptible distinction between still-refining and settled.

# Complete:

Deterministic/browser tests exercise `docs/components/weather.md` §Verification through one testable Weather semantics owner: a trustworthy provisional Constellation stays visible and navigable while structural work remains `Updating…`; accepted refinement can recompose/republish the current view; successful settlement reaches `Ready`/check; legitimate empty structure settles successfully; failure to establish any trustworthy current structure degrades globally; failed further refinement preserves already trustworthy structure while the failed/unknown dependency reaches a terminal settled outcome; obsolete-generation completion cannot settle or mutate the replacement view; supplementary late evidence does not reopen successful Weather; and debounce/coalescing avoids unnecessary fidgeting without falsely presenting an unsettled view as settled.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If an outcome's completion condition is satisfied, run Backlog Close for that outcome. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
