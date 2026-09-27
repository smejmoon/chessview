# Do:

Make exact-tip deterministic CI available directly for named task branches without requiring a temporary pull request or a `main` mutation solely to obtain `Verify` evidence.

# Because:

`docs/components/delivery.md` §Continuous integration says `.github/workflows/ci.yml` is the verification authority and that its `Verify` job is the merge-readiness signal. The current workflow runs on pull requests targeting `main`, pushes to `main`, and manual dispatch, while branch previews publish independently. In the `mooves` integration this required opening a PR only to trigger CI for the already-distilled task-branch tip.

# Edges:

Keep production Pages publication rules unchanged and keep branch preview success distinct from CI success. Avoid making every exploratory branch expensive unless that cost is explicitly accepted; the outcome is reliable exact-tip verification, not a particular trigger syntax.

# Unsettled:

Choose between CI on all named-task-branch pushes, a narrower branch pattern, or a repository-supported manual-dispatch path that connected ChatGPT can invoke and whose result is tied to the exact branch SHA.

Decide whether preview publication and CI should remain parallel or whether the branch workflow should surface both statuses together without coupling their execution.

# Complete:

A named task branch can obtain a `Verify` result for its exact tip without opening a PR and without moving `main`; branch-preview guidance points to the supported mechanism; integration preflight can unambiguously verify that result; CI and Pages responsibilities remain separate.

# Steps:

Select the lowest-cost trigger/invocation mechanism consistent with current GitHub access and delivery policy.

Update workflow/policy documentation together if the supported developer command changes.

Exercise the mechanism on a non-main branch and verify the resulting run is attributable to the exact branch tip.

# Sync:

After any implementation or verification step that changes what remains, and before ending an implementation pass, rewrite this entry around the factual work and verification still open; do not accumulate progress history. If `Complete:` is satisfied, run Backlog Close. If Close cannot pass its normal gates, leave the entry open with the blocking condition explicit.
