import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { START_FEN, canonicalPosition } from '../src/graph.ts';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph } = await import('../src/db.ts');
const { clearExplorerCacheFields, getNode, putNode } = await import('../src/position-store.ts');
const { createExplorerProvider } = await import('../src/explorer.ts');
const { createPositionRepository } = await import('../src/position-repository.ts');
const { nodeStoreVersion } = await import('../src/position-store.ts');
const { clearExplorerCache } = await import('../src/explorer-cache.ts');
const { isObsoleteWork } = await import('../src/obsolete-work.ts');

test('Explorer cache fields can be cleared selectively without deleting structural position data', async () => {
  await clearGraph();
  const first = canonicalPosition(START_FEN);
  const second = canonicalPosition('8/8/8/8/8/4k3/4P3/4K3 w - - 0 1');
  await putNode({ key: first, fen: START_FEN, explorer: { white: 1 }, explorerFetchedAt: 123, explorerRequestProfile: 'legacy-profile', games: 1, opening: { name: 'cached' }, structural: 'keep' });
  await putNode({ key: second, explorer: { white: 2 }, explorerFetchedAt: 456, games: 2, structural: 'also keep' });

  await clearExplorerCacheFields([first]);
  const cleared = await getNode(first);
  const untouched = await getNode(second);
  assert.equal(cleared.structural, 'keep');
  assert.equal('explorer' in cleared, false);
  assert.equal('explorerFetchedAt' in cleared, false);
  assert.equal('explorerRequestProfile' in cleared, false);
  assert.equal('games' in cleared, false);
  assert.equal('opening' in cleared, false);
  assert.ok(untouched.explorer);

  await clearExplorerCacheFields();
  const globallyCleared = await getNode(second);
  assert.equal(globallyCleared.structural, 'also keep');
  assert.equal('explorer' in globallyCleared, false);
});

test('Explorer provider invalidation drops repository-owned live readings', async () => {
  const repository = createPositionRepository({
    read: async () => null,
    write: async (value) => value,
    version: () => 0,
  });
  const provider = createExplorerProvider({
    repository,
    request: async () => ({
      ok: true,
      status: 200,
      async json() { return { white: 1, draws: 0, black: 0, moves: [] }; },
      async text() { return ''; },
    }),
    log() {},
  });
  const position = canonicalPosition(START_FEN);
  await provider.ensure(position);
  assert.ok(provider.current(position));
  assert.ok(repository.currentSourceChannel(position, 'explorer'));

  provider.invalidate([position]);

  assert.equal(provider.current(position), null);
  assert.equal(repository.currentSourceChannel(position, 'explorer'), null);
});


test('Explorer maintenance drains an orphaned persistence write before clearing', async () => {
  await clearGraph();
  const position = canonicalPosition(START_FEN);
  await putNode({ key: position, fen: START_FEN, structural: 'keep' });

  let permitWrite;
  let enteredWrite;
  const writeStarted = new Promise((resolve) => { enteredWrite = resolve; });
  const writeGate = new Promise((resolve) => { permitWrite = resolve; });
  const repository = createPositionRepository({
    read: getNode,
    write: async (record) => {
      if (record.explorer) {
        enteredWrite();
        await writeGate;
      }
      return putNode(record);
    },
    version: nodeStoreVersion,
  });
  const provider = createExplorerProvider({
    repository,
    request: async () => ({
      ok: true,
      status: 200,
      async json() { return { white: 3, draws: 1, black: 0, moves: [] }; },
      async text() { return ''; },
    }),
    log() {},
  });
  const caller = new AbortController();
  const pending = provider.ensure(position, { signal: caller.signal });
  await writeStarted;

  // No subscribers remain, but the already-entered node write ignores abort.
  const abandoned = assert.rejects(pending, isObsoleteWork);
  caller.abort();
  await abandoned;

  const clearing = clearExplorerCache([position], { repository, explorer: provider });
  let cleared = false;
  void clearing.then(() => { cleared = true; });
  await Promise.resolve();
  assert.equal(cleared, false, 'clear must wait for the detached write');

  permitWrite();
  await clearing;
  assert.equal(cleared, true);
  assert.equal(provider.current(position), null);
  const stored = await getNode(position);
  assert.equal(stored.structural, 'keep');
  assert.equal(Object.hasOwn(stored, 'explorer'), false);
  assert.equal(Object.hasOwn(stored, 'explorerFetchedAt'), false);
  assert.equal(Object.hasOwn(stored, 'explorerRequestProfile'), false);
  await assert.rejects(provider.ensure(position), isObsoleteWork);
});

test('canonical position storage strips legacy top-level OpeningLabel metadata', async () => {
  await clearGraph();
  const position = canonicalPosition(START_FEN);
  const stored = await putNode({
    key: position,
    fen: START_FEN,
    opening: { eco: 'B14', name: 'Caro-Kann Defense: Panov Attack' },
    structural: 'keep',
  });

  assert.equal(Object.hasOwn(stored, 'opening'), false);
  const reread = await getNode(position);
  assert.equal(Object.hasOwn(reread, 'opening'), false);
  assert.equal(reread.structural, 'keep');
});
