import { isObsoleteWork } from './obsolete-work.ts';

export type ExplorerRefinementOutcome = Readonly<{ refinement: 'unavailable' }>;

export type ExplorerRefinementFailureClassifier = (error: unknown) => ExplorerRefinementOutcome | null;

// Source acquisition has already exhausted provider-owned fallback here.
// A 429 ends this refinement attempt; the gateway still owns its shared cooldown.
export function createExplorerRefinementFailureClassifier(): ExplorerRefinementFailureClassifier {
  return (error: unknown): ExplorerRefinementOutcome | null => {
    if (isObsoleteWork(error)) return null;
    return Object.freeze({ refinement: 'unavailable' as const });
  };
}

export const classifyExplorerRefinementFailure = createExplorerRefinementFailureClassifier();
