import { lichessGateway } from './lichess-gateway.js';
import { isObsoleteWork } from './obsolete-work.js';

export type ExplorerRefinementOutcome =
  | Readonly<{ refinement: 'retryable'; retry: PromiseLike<unknown> }>
  | Readonly<{ refinement: 'unavailable' }>;

export type ExplorerRefinementFailureClassifier = (error: unknown) => ExplorerRefinementOutcome | null;

type ClassifierOptions = Readonly<{
  cooldownUntil?: () => number;
  now?: () => number;
  sleep?: (ms: number) => PromiseLike<unknown>;
}>;

function httpStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

export function createExplorerRefinementFailureClassifier({
  cooldownUntil = () => lichessGateway.cooldownUntil,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: ClassifierOptions = {}): ExplorerRefinementFailureClassifier {
  return (error: unknown): ExplorerRefinementOutcome | null => {
    if (isObsoleteWork(error)) return null;
    if (httpStatus(error) === 429) {
      const retryAfterMs = Math.max(0, cooldownUntil() - now());
      if (retryAfterMs > 0) {
        return Object.freeze({
          refinement: 'retryable' as const,
          retry: sleep(retryAfterMs),
        });
      }
    }
    return Object.freeze({ refinement: 'unavailable' as const });
  };
}

export const classifyExplorerRefinementFailure = createExplorerRefinementFailureClassifier();
