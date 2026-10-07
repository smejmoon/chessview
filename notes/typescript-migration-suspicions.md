# TypeScript migration suspicions

Observations surfaced while converting ChessView-owned executable code to TypeScript on `10-07-typescript`.

These are investigation leads, not accepted architecture or backlog commitments. Migration repairs should preserve behavior; broader cleanup should be assayed separately.

## Empty-object defaults hiding required inputs

Several converted modules use `= {}` on parameter objects while their implementations immediately expect meaningful fields. TypeScript consequently infers misleadingly narrow or optional shapes.

Seen in:
- `src/lichess-gateway.ts`
- `src/lichess-session.ts`
- `src/promotion-chooser.ts`
- `src/recenter-input.ts`
- `src/root-enrichment.ts`

The migration should type the existing behavior. Separately investigate whether these APIs should require their real dependencies instead of pretending an empty invocation is valid.

## Callback contracts inferred from placeholder defaults

Some callbacks are initialized with no-argument placeholder functions but are later called or replaced with argument-taking functions. TypeScript exposes the accidental contract.

Seen in:
- `src/lichess-gateway.ts`
- `src/nodus-presenter.ts`
- `src/line-frontier.ts`
- `src/view-status.ts`

Investigate whether these callbacks belong behind explicit interfaces rather than implementation-local defaults.

## Presentation parameter bags

Nodus/promotion presentation calls pass structurally rich object literals whose accepted types currently describe only subsets of the actual fields (for example `source`, `center`, `to`, and promotion choices). Investigate whether presentation/input APIs have drifted from their declared contracts.

Seen in:
- `src/nodus-renderer.ts`
- `src/promotion-chooser.ts`
- `src/recenter-input.ts`
