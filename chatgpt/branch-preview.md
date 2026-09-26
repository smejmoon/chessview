# Branch preview workflow

Use this as Chessview's default feature-development lifecycle when a task benefits
from inspecting a deployed result before it reaches production.

The lifecycle is:

`branch -> implement -> preview -> review -> distill -> merge -> cleanup`

This file owns the lifecycle and command meanings. Repository policy stays in
`chatgpt/chessview-gpt.md`; executable CI and deployment behavior stays in
`.github/workflows/`.

## Start work

`work on branch <name>` establishes a named task branch from current `main` when
it does not already exist. That branch becomes this-chat branch. Keep feature
writes there until the human explicitly changes the target.

Small maintenance work may still happen directly on `main` when the Chessview
adapter permits it, but branch work is the default when preview, review, or
history distillation is useful.

## Implement

Make coherent checkpoint commits on the task branch. Verify available tests and
build automation after code-affecting changes. The dedicated CI workflow may be
run on demand for the exact branch tip; branch-preview publication is separate
and is not by itself merge-readiness evidence. Checkpoints are execution history,
not necessarily the final history worth keeping.

## Preview

`preview` means publish or refresh the task branch's non-production preview using
the repository's current preview mechanism, then report the exact preview URL or
report why no preview mechanism is available.

A preview must not replace the production deployment from `main`. Preview
publication may occur independently of CI because it is a development artifact,
not an assertion that the branch is ready to merge.

## Review

Use the narrowest review requested by the human. Common commands are:

- `assay` — audit this-chat branch against `main` under the Chessview Assay
  adapter;
- `cold assay` — prepare the independent audit flow defined by the adapter;
- `show diff from main` — inspect the complete task change without mutating it.

After review fixes, refresh the preview when the visible result may have changed.

## Distill

`distill history` routes to Strake `distill-history`. It may rewrite only an
explicitly authorized named non-`main` task branch and keeps all of that skill's
safety and verification requirements.

Because commit identities change, re-establish any CI, preview, or review evidence
whose validity was tied to the replaced commits.

## Ready to merge

`ready to merge` is read-only preflight. Re-resolve the task branch and current
`main`, inspect their relationship, verify current CI evidence for the exact task
branch tip and the current preview state, and report any integration or evidence
that must be refreshed before merge.

Do not treat readiness as authorization to merge.

## Merge and ship

An explicit request such as `merge <branch> into main` or `ship` authorizes the
Chessview adapter's task-branch integration exception after a successful fresh
preflight.

Immediately before mutation, re-resolve both the named task branch and `main`.
If `main` is still an ancestor of the task branch, prefer a non-force
fast-forward of `main` to the exact verified task-branch tip. This preserves the
distilled branch history without manufacturing an extra merge commit.

If `main` has moved or the histories have diverged, do not force-update `main`.
Use only a repository-supported connected-GitHub merge mechanism that preserves
both lineages and whose result can be verified. If no such safe mechanism is
available, stop and report the exact integration handoff rather than guessing or
rewriting history.

After integration, re-resolve `main` and verify both the GitHub Actions CI
workflow and the production Pages build/deploy workflow on the resulting `main`
tip. A task branch's pre-merge CI remains useful preflight evidence, but it does
not replace post-integration CI when the resulting commit identity differs.

## Cleanup

After production is verified, remove branch-preview state only through the
repository's supported cleanup mechanism. Deleting a task branch or preview is
separate mutation and requires the authorization implied by the human's cleanup
request; do not make cleanup a hidden side effect of merge.
