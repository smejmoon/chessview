# ChatGPT integration

This directory owns Chessview's repository-backed ChatGPT integration. It is
runtime agent guidance, not product documentation.

## Project adapter

`chessview-gpt.md` is the regular-work adapter for maintaining
`smejmoon/chessview` through connected GitHub access.

The adapter uses `smejmoon/strake` `main` as the shared policy source and selects
only the Strake rules and skills useful to Chessview. Shared procedures such as
Assay orientation and GitHub search recovery are referenced from Strake rather
than copied here.

Chessview keeps one deliberate project-specific difference from Strake's own
regular-work adapter: direct writes to `main` are allowed when the human has
explicitly authorized implementation work in the current conversation. Skills
with stricter write contracts keep those stricter contracts; in particular,
`distill-history` may rewrite only an explicitly authorized named non-`main`
task branch.

## Bootstrap

A ChatGPT Project for this repository can use a minimal bootstrap instruction:

> This Project works on `smejmoon/chessview`. Use `smejmoon/strake` `main` as the shared policy source unless I explicitly name another Strake policy ref. Fetch `chatgpt/chessview-gpt.md` from Chessview `main` and follow it.

Product requirements and terminology remain in `docs/PLAN.md`; this directory
only owns ChatGPT runtime composition and repository-work mechanics.
