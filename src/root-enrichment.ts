import { START_FEN, canonicalPosition } from './graph.ts';
import { reconstructPgnPath } from './pgn.ts';
import { positionGraph } from './position-graph.ts';
import { expandMoveOrderTranspositions } from './transpositions.ts';

const START = canonicalPosition(START_FEN);
const ROOT_REFERENCE_PATH_MAX_DEPTH = 32;
const ROOT_TRANSPOSITION_MAX_PATHS = 256;
const ROOT_TRANSPOSITION_MAX_STATES = 75_000;

function abortError() {
  const error = new Error('Root enrichment participation became obsolete');
  error.name = 'AbortError';
  return error;
}

async function referencePathFor(target, { maxDepth = ROOT_REFERENCE_PATH_MAX_DEPTH } = {}) {
  const incomingByTarget = new Map();
  const queue = [{ key: target, depth: 0 }];
  const seen = new Set();
  while (queue.length) {
    const current = queue.shift();
    if (seen.has(current.key) || current.depth >= maxDepth) continue;
    seen.add(current.key);
    const incoming = await positionGraph.incoming(current.key);
    incomingByTarget.set(current.key, incoming);
    if (incoming.some((edge) => edge.source === START)) break;
    for (const edge of incoming) {
      if (!seen.has(edge.source)) queue.push({ key: edge.source, depth: current.depth + 1 });
    }
  }
  return reconstructPgnPath(target, incomingByTarget, START);
}

function join(work, signal) {
  if (!signal) return work;
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    work.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export function createRootTranspositionEnricher({
  loadReferencePath = referencePathFor,
  expand = expandMoveOrderTranspositions,
} = {}) {
  const expandedTargets = new Set();
  const inFlight = new Map();

  function start(target) {
    const work = (async () => {
      const referencePath = await loadReferencePath(target);
      if (!referencePath?.length) return null;
      const result = await expand(referencePath, target, {
        maxPaths: ROOT_TRANSPOSITION_MAX_PATHS,
        maxStates: ROOT_TRANSPOSITION_MAX_STATES,
      });
      expandedTargets.add(target);
      return result;
    })().finally(() => {
      if (inFlight.get(target) === work) inFlight.delete(target);
    });

    // The producer is deliberately independent of any one view. Keep a rejection
    // handler attached even if every current subscriber detaches before it ends.
    work.catch(() => {});
    inFlight.set(target, work);
    return work;
  }

  function ensure(target, { signal }: { signal?: AbortSignal } = {}) {
    if (signal?.aborted) return Promise.reject(abortError());
    if (!target || expandedTargets.has(target)) return Promise.resolve(null);
    const work = inFlight.get(target) ?? start(target);
    return join(work, signal);
  }

  return Object.freeze({ ensure });
}

export const rootTranspositionEnricher = createRootTranspositionEnricher();
