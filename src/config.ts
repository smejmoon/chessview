/**
 * Central home for Chessview implementation tunables.
 *
 * Keep concrete knobs here when maintainers should be able to find and adjust
 * them without hunting through the algorithm that consumes them: limits,
 * thresholds, sample floors, timeouts, and similar policy values. Examples
 * include Constellation lookahead breadth, prevalence thresholds such as 5%,
 * and Rail classification cutoffs.
 *
 * Product/component documents still own what a tunable means, which behavior
 * it controls, and any invariants around it. This module owns the concrete
 * source value so algorithms do not duplicate magic numbers.
 *
 * Do not use this file for user preferences, environment/secret configuration,
 * source facts, canonical identities, protocol constants, or values that are
 * intrinsic invariants rather than tunable policy.
 */
export const CONSTELLATION_LOOKAHEAD_LIMIT = 4;
export const GRAPH_EDGE_ADMISSION_SAMPLE_FLOOR = 80;
