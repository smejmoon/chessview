# ChatGPT integration

This directory owns Chessview's repository-backed ChatGPT integration. It is
runtime agent guidance, not product documentation.

## Project adapter

`chessview-gpt.md` is the regular-work adapter for maintaining
`smejmoon/chessview` through connected GitHub access.

The adapter keeps three authorities distinct:

- the **this-chat branch** that contains the work product;
- Chessview `main` as the **project-policy ref**;
- Strake `main` as the **shared-policy ref**, unless the human explicitly names
  another Strake policy ref for adapter development.

Shared mechanisms such as connected-GitHub inspection, Assay orientation, cold
Assay, and GitHub search recovery are referenced from `smejmoon/strake` rather
than copied here. If shared mechanics and the Chessview adapter conflict, the
runtime stops instead of silently choosing the more permissive rule.

Chessview keeps one deliberate project-specific difference from Strake's own
regular-work adapter: direct writes to Chessview `main` are allowed when the
human has explicitly authorized implementation work in the current conversation
and has not established another task branch. Skills with stricter write contracts
keep those stricter contracts; in particular, `distill-history` may rewrite only
an explicitly authorized named non-`main` task branch.

## Default branch workflow

`branch-preview.md` owns Chessview's compact branch-development lifecycle and
its conversational commands:

`branch -> implement -> preview -> review -> distill -> merge -> cleanup`

It is intentionally project-local for now. `chessview-gpt.md` owns policy and
authorization, while `.github/workflows/` owns executable CI and deployment
behavior.

## Bootstrap

ChatGPT Project Instructions are bootstrap only. They should establish the
project, the work ref, and the two policy refs, then point at the repository-owned
adapter. Do not copy rule bodies, skill procedures, GitHub mechanics, Assay
procedure, or the branch workflow into the Project Instructions.

Use:

> This Project works on `smejmoon/chessview` and uses shared Strake policy from `smejmoon/strake`. At the start of a new chat, if the request names no task branch, use Chessview `main` as this-chat branch; otherwise use the human-named branch, resolving it if present and recording the name without creating it if absent. Use Chessview `main` as the project-policy ref. Use Strake `main` as the Strake policy ref unless I explicitly name another Strake policy ref for adapter development. Fetch `chatgpt/chessview-gpt.md` from the Chessview project-policy ref and follow it.

Product documentation starts at `docs/README.md`: `docs/vision.md` owns durable
product direction and language, `docs/product.md` owns cross-product conditions,
and the component and architecture documents own exact behavior and boundaries.
Unfinished work belongs in `backlog/`. This directory only owns ChatGPT runtime
composition and repository-work mechanics.
