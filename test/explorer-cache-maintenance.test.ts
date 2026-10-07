import test from 'node:test';
import assert from 'node:assert/strict';
import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { START_FEN, canonicalPosition } from '../src/graph.ts';

globalThis.indexedDB = fakeIndexedDB;

const { clearGraph } = await import('../src/db.ts');
const { clearExplorerCacheFields, getNode, putNode } = await import('../src/position-store.ts');
const { createExplorerProvider } = await import('../src/explorer.ts');
const { createPositionRepository } = await import('../src/position-repository.ts');

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
  assert.ok(repository.currentFacet(position, 'explorer'));

  provider.invalidate([position]);

  assert.equal(provider.current(position), null);
  assert.equal(repository.currentFacet(position, 'explorer'), null);
});


test('canonical position storage strips legacy top-level opening identity', async () => {
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
