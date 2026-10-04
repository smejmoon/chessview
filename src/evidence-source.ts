import {
  humanMismatch,
  humanResultQuality,
  moveEvaluation,
  moveFrequency,
  positionEvaluation,
  rootRarityFromFrequency,
} from './evidence.js';
import {
  currentExplorerReading,
  readCachedExplorerReading,
} from './explorer.js';
import type { ExplorerReading } from './knowledge-acquisition.ts';
import { lichessEval } from './lichess-eval.js';
import { mastersProvider } from './masters.js';
import { throwIfObsolete } from './obsolete-work.js';

type CurrentExplorer = (position: string) => ExplorerReading | null;
type ReadCachedExplorer = (position: string) => Promise<ExplorerReading | null>;
type AvailableProvider = Readonly<{
  available(position: string): Promise<unknown>;
}>;

type FrequencyEvidence = Readonly<{
  games?: number;
  sourceGames?: number;
  share: number;
}>;

type MoveQualityEvidence = Readonly<{
  lossCp: number;
  quality: string;
}>;

type HumanResultEvidence = Readonly<{
  quality: string;
  games?: number;
  score?: number;
  deficit?: number;
}>;

export type EvidenceEdge = Readonly<{
  source: string;
  target: string;
  uci: string;
  san?: string;
}>;

export type PositionEvidence = Readonly<{
  evaluation: unknown | null;
}>;

export type MoveEvidence = Readonly<{
  frequency: FrequencyEvidence | null;
  moveEval: MoveQualityEvidence | null;
  humanResult: HumanResultEvidence | null;
  mastersMismatch: unknown | null;
  lichessMismatch: unknown | null;
  rarity: string | null;
}>;

export type MoveEvidenceOptions = Readonly<{
  comparisons?: boolean;
}>;

export type EvidenceReader = Readonly<{
  ratedReadingAvailable(position: string): Promise<boolean>;
  position(position: string): Promise<PositionEvidence>;
  move(edge: EvidenceEdge, options?: MoveEvidenceOptions): Promise<MoveEvidence>;
}>;

export type EvidenceReaderOptions = Readonly<{
  signal?: AbortSignal;
  currentExplorer?: CurrentExplorer;
  readCachedExplorer?: ReadCachedExplorer;
  evalProvider?: AvailableProvider;
  mastersProvider?: AvailableProvider;
}>;

type MoveEvaluation = (
  sourceKey: string,
  edge: EvidenceEdge,
  sourceEval: unknown,
  targetEval?: unknown,
) => MoveQualityEvidence | null;

const deriveMoveEvaluation = moveEvaluation as MoveEvaluation;

function immutable<T>(value: T): T {
  if (Array.isArray(value)) return Object.freeze(value.map(immutable)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([key, child]) => [key, immutable(child)]),
    )) as T;
  }
  return value;
}

export function createEvidenceReader({
  signal,
  currentExplorer = currentExplorerReading as CurrentExplorer,
  readCachedExplorer = readCachedExplorerReading as ReadCachedExplorer,
  evalProvider = lichessEval as AvailableProvider,
  mastersProvider: masters = mastersProvider as AvailableProvider,
}: EvidenceReaderOptions = {}): EvidenceReader {
  const explorerReads = new Map<string, Promise<ExplorerReading | null>>();
  const evalReads = new Map<string, Promise<unknown>>();
  const mastersReads = new Map<string, Promise<unknown>>();

  function explorerFor(position: string): Promise<ExplorerReading | null> {
    const existing = explorerReads.get(position);
    if (existing) return existing;
    const pending = (async () => {
      throwIfObsolete(signal, 'Evidence read became obsolete');
      const current = currentExplorer(position);
      const reading = current ?? await readCachedExplorer(position);
      throwIfObsolete(signal, 'Evidence read became obsolete');
      return reading;
    })();
    explorerReads.set(position, pending);
    return pending;
  }

  function evalFor(position: string): Promise<unknown> {
    const existing = evalReads.get(position);
    if (existing) return existing;
    const pending = Promise.resolve(evalProvider.available(position));
    evalReads.set(position, pending);
    return pending;
  }

  function mastersFor(position: string): Promise<unknown> {
    const existing = mastersReads.get(position);
    if (existing) return existing;
    const pending = Promise.resolve(masters.available(position));
    mastersReads.set(position, pending);
    return pending;
  }

  async function ratedReadingAvailable(position: string): Promise<boolean> {
    return Boolean(await explorerFor(position));
  }

  async function position(positionKey: string): Promise<PositionEvidence> {
    throwIfObsolete(signal, 'Evidence read became obsolete');
    const cloud = await evalFor(positionKey);
    throwIfObsolete(signal, 'Evidence read became obsolete');
    return immutable({ evaluation: positionEvaluation(cloud) });
  }

  async function move(
    edge: EvidenceEdge,
    { comparisons = true }: MoveEvidenceOptions = {},
  ): Promise<MoveEvidence> {
    throwIfObsolete(signal, 'Evidence read became obsolete');
    const [explorer, sourceEval] = await Promise.all([
      explorerFor(edge.source),
      evalFor(edge.source),
    ]);
    throwIfObsolete(signal, 'Evidence read became obsolete');
    const targetEval = sourceEval ? await evalFor(edge.target) : null;
    throwIfObsolete(signal, 'Evidence read became obsolete');

    const frequency = moveFrequency(explorer, edge) as FrequencyEvidence | null;
    const moveEval = deriveMoveEvaluation(edge.source, edge, sourceEval, targetEval);
    const humanResult = humanResultQuality(explorer, edge, edge.source) as HumanResultEvidence | null;

    let mastersMismatch: unknown | null = null;
    let lichessMismatch: unknown | null = null;
    if (comparisons && moveEval) {
      const mastersReading = await mastersFor(edge.source);
      throwIfObsolete(signal, 'Evidence read became obsolete');
      mastersMismatch = humanMismatch(mastersReading, edge, edge.source, moveEval);
      lichessMismatch = humanMismatch(explorer, edge, edge.source, moveEval);
    }

    return immutable({
      frequency,
      moveEval,
      humanResult,
      mastersMismatch,
      lichessMismatch,
      rarity: rootRarityFromFrequency(frequency),
    });
  }

  return Object.freeze({ ratedReadingAvailable, position, move });
}
