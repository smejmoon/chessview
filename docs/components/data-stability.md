# Data stability

## Purpose

Define which Chessview facts remain true, which external observations can change, and how that difference guides cache freshness. [Position cache](../architecture/position-cache.md) owns general reuse and refresh mechanics; `src/config.ts` owns the concrete refresh intervals.

## Principles

- **Data stability guides expiration.** Set refresh intervals based on the likelihood of meaningful change in the source population or the value of a newer observation, not the other way around.
- **Expiration requests reconsideration, not deletion.** No hard maximum cache age disqualifies an otherwise valid, compatible positive observation. Its timestamp says when to look for improvements, not whether it was ever true.
- **Persistence and freshness are independent.** Established legal Graph Edges and canonical positions outlive source-observation refreshes. A changing Explorer game count cannot retract an established legal Line.
- **Reuse cached data only if it answers the same question.** The canonical position, source population, meaningful filters, and required response information must match. Rated Lichess counts cannot substitute for Masters. An older Explorer Reading lacking representative-game information cannot fulfill Root discovery's fuller request.
- **Failures do not rewrite facts.** A 401, 429, disconnected network, invalid payload, or storage failure does not make a known legal move false or turn missing evidence into zero.
- **Fresh information improves navigation rather than being a prerequisite.** After normal startup authorization, compatible retained observations may supply the Constellation and Rail immediately while refresh happens in the background.

## What changes

| Chessview data | Stability assumption | Why it may be reconsidered |
| --- | --- | --- |
| Canonical positions and validated legal Graph Edges | Stable under the same chess rules and identity | Rules, identity, or incompatible storage schema require separate compatibility decisions, not source TTL eviction |
| Completed games and bounded historical observations | Historical facts remain useful for long periods | A source may correct, delete, or reindex historical records; a date bound is not proof of immutability |
| Masters Opening Explorer | Slowly evolving historical aggregate evidence | Additional games, corrections, and dataset updates may change counts |
| Rated Lichess Opening Explorer | Valid observation of an ongoing game population | Counts, result ratios, move rankings, and recent/top references evolve |
| Cloud evaluation | A quality-accepted evaluation remains useful when newer data is unavailable | New analyses may provide greater depth or useful alternatives; newer timestamps alone do not guarantee better evaluations |
| Opening names | Helpful source-local labels, not canonical-position identity | Classifications can change and may depend on move history |
| Source absence, such as cloud-eval 404 | An observation that no usable source result was available at that time | Absence may cease to hold; it must not be treated as permanent chess evidence |

## In Chessview terms

Returning to a known Nodus should show the available Constellation and Rail from a compatible ten-day-old Explorer Reading. Background refresh may improve Prevalence or result evidence, but failure leaves established Lines intact. A thirty-day-old Masters Reading can still support comparison while a newer one is sought. A usable cloud evaluation does not stop being useful when its refresh date passes; a shallow evaluation does not become useful simply because it is fresh.

Successful source absence is different: a cloud-eval 404 means only that the source had no evaluation then. It deserves rechecking, not a permanent negative conclusion.

## Ownership

This document owns assumptions about the meaning and stability of observations, not cache algorithms, HTTP scheduling, or exact TTL values. [Opening Explorer databases](opening-explorer-databases.md) describes populations and payloads; [Evidence](evidence.md) interprets usable observations; [Lichess access](lichess-access.md) owns endpoint and authorization behavior. The current numeric refresh choices are in `src/config.ts`.
