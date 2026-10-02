/**
 * Central home for Chessview implementation tunables.
 *
 * Keep Chessview-chosen quantitative policy here when maintainers should be
 * able to find and adjust it without hunting through the consumer: limits,
 * thresholds, sample floors, timeouts, cache lifetimes, and similar knobs.
 * Product/component documents still own what each value means and any
 * invariants around it; this module owns the concrete source value.
 *
 * Do not use this file for user preferences, environment/secret configuration,
 * external service requirements, source facts, canonical identities, protocol
 * constants, storage/schema identities, or intrinsic algorithm invariants.
 * Semantic implementation-local values should instead be named beside their
 * consumer. See docs/architecture/quantitative-values.md for the ownership
 * heuristic and review guidance.
 */
export const CONSTELLATION_LOOKAHEAD_LIMIT = 4;
export const CONSTELLATION_RARE_SHARE = 0.05;
export const GRAPH_EDGE_ADMISSION_SAMPLE_FLOOR = 80;
export const SUPPLEMENTARY_EXPLORER_WARM_TIMEOUT_MS = 30_000;

export const ENGINE_DUBIOUS_CP = 50;
export const ENGINE_BAD_CP = 100;
export const HUMAN_RESULT_SAMPLE_FLOOR = 200;
export const HUMAN_FAVORABLE_DELTA = 0.02;
export const HUMAN_UNFAVORABLE_DELTA = 0.08;
export const HUMAN_MISMATCH_SAMPLE_FLOOR = 100;
export const HUMAN_MISMATCH_DELTA = 0.05;
export const ROOT_RARE_SHARE = 0.05;
export const ROOT_VERY_RARE_SHARE = 0.01;
export const ROOT_RARITY_SAMPLE_FLOOR = 100;

export const EXPLORER_TTL_MS = 24 * 60 * 60 * 1000;
export const MASTERS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const LICHESS_EVAL_MIN_DEPTH = 18;
export const LICHESS_EVAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const LICHESS_REQUEST_MIN_INTERVAL_MS = 250;
