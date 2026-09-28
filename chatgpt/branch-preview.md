# Branch preview workflow

Use this as Chessview's default feature-development lifecycle when a task benefits
from inspecting a deployed result before it reaches production:

`branch -> implement -> preview -> review -> distill -> merge`

This file owns lifecycle transitions and command meanings. `chatgpt/chessview-gpt.md`
owns repository policy and integration authority; `docs/components/delivery.md`
§Verification owns CI evidence semantics; `.github/workflows/` owns executable CI
and deployment behavior.

## Start work

`work on branch <name>` establishes a named task branch from current `main` when
it does not already exist. That branch becomes this-chat branch. Keep feature
writes there until the human explicitly changes the target.

## Implement

Make coherent checkpoint commits on the task branch. Pushing a named task-branch
checkpoint triggers CI for that branch tip. After code-affecting changes,
establish exact-tip verification using `docs/components/delivery.md` §Verification.

Checkpoints are execution history, not necessarily the final history worth
keeping.

## Preview

`preview` means publish or refresh the task branch's non-production preview using
the repository's current preview mechanism, then report the exact preview URL or
the blocker when publication is unavailable.

A preview must not replace production from `main`. Preview success is inspection
evidence, not CI verification.

## Review

Use the narrowest review requested by the human. Common commands are:

- `assay` — audit this-chat branch against `main` under the Chessview Assay
  adapter;
- `cold assay` — prepare the independent audit flow defined by the adapter;
- `show diff from main` — inspect the complete task change without mutating it.

After review fixes, refresh the preview when the visible result may have changed.

## Distill

`distill history` routes to Strake `distill-history`.

Because distillation changes commit identities, re-establish exact-tip
verification using `docs/components/delivery.md` §Verification and refresh any
preview or review evidence tied to replaced commits.

## Ready to merge

`ready to merge` is read-only preflight. Re-resolve the task branch and current
`main`, inspect their relationship, establish exact-tip verification using
`docs/components/delivery.md` §Verification, verify the current preview state,
and report anything that must be refreshed or resolved before integration.

## Merge and ship

`merge <branch> into main` and `ship` route to
`chatgpt/chessview-gpt.md` §Task-branch integration exception after a successful
fresh preflight. That project-policy section owns the integration mechanics and
authorization boundary.

Merge does not delete the task branch. Preview retention follows branch existence
as defined by `docs/components/delivery.md` §Pages reset: deleting a task branch
makes its preview absent after the next `reset-pages` reconstruction.

## Reset Pages

`reset-pages` means run the repository's `Reset Pages` workflow from current
`main`. It rebuilds publication from current branch refs and replaces `gh-pages`
according to `docs/components/delivery.md` §Pages reset. It is publication
maintenance only: it does not authorize a merge or delete any source branch.
