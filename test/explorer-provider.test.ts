import assert from 'node:assert/strict';
import test from 'node:test';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
globalThis.window = { location: { href: 'https://example.test/chessview/', search: '' } };
globalThis.history = { state: null, replaceState() {} };

const { START_FEN, canonicalPosition } = await import('../src/graph.ts');
const { createExplorerProvider } = await import('../src/explorer.ts');
const { createPositionRepository } = await import('../src/position-repository.ts');

const CENTER = canonicalPosition(START_FEN);

function explorerReading() {
  return {
    white: 10,
    draws: 5,
    black: 5,
    moves: [{ uci: 'e2e4', white: 6, draws: 2, black: 2 }],
  };
}

test('Explorer admits once and reuses the live observation when persistence fails', async () => {
  let requests = 0;
  let writes = 0;
  const repository = createPositionRepository({
    read: async () => null,
    write: async () => {
      writes += 1;
      throw new Error('storage unavailable');
    },
    version: () => 0,
  });
  const reading = explorerReading();
  const provider = createExplorerProvider({
    repository,
    request: async () => {
      requests += 1;
      return {
        ok: true,
        status: 200,
        json: async () => reading,
        text: async () => '',
      };
    },
    now: () => 1_000,
    log: () => {},
  });

  assert.equal(provider.current(CENTER), null);
  const [first, second] = await Promise.all([
    provider.ensure(CENTER),
    provider.ensure(CENTER),
  ]);

  assert.equal(requests, 1);
  assert.equal(writes, 1);
  assert.strictEqual(first, second);
  assert.strictEqual(provider.current(CENTER), first);

  const later = await provider.ensure(CENTER);
  assert.strictEqual(later, first);
  assert.equal(requests, 1);
  assert.equal(writes, 1);
});

test('reading current Explorer state is passive and does not start acquisition', async () => {
  let requests = 0;
  const repository = createPositionRepository({
    read: async () => null,
    write: async () => {},
    version: () => 0,
  });
  const provider = createExplorerProvider({
    repository,
    request: async () => {
      requests += 1;
      return {
        ok: true,
        status: 200,
        json: async () => explorerReading(),
        text: async () => '',
      };
    },
    now: () => 2_000,
    log: () => {},
  });

  assert.equal(provider.current(CENTER), null);
  await Promise.resolve();
  assert.equal(requests, 0);

  const reading = await provider.ensure(CENTER);
  assert.equal(requests, 1);
  assert.strictEqual(provider.current(CENTER), reading);
});


test('Explorer request profile refreshes a legacy aggregate cache once and then reuses it', async () => {
  let requests = 0;
  let requestedUrl = null;
  let stored = {
    key: CENTER,
    fen: START_FEN,
    explorer: explorerReading(),
    explorerFetchedAt: 1_000,
  };
  const refreshed = {
    ...explorerReading(),
    topGames: [{ id: 'abcdefgh' }],
    recentGames: [{ id: 'ijklmnop' }],
  };
  const repository = createPositionRepository({
    read: async () => stored,
    write: async (value) => { stored = value; return value; },
    version: () => 0,
  });
  const provider = createExplorerProvider({
    repository,
    request: async (url) => {
      requests += 1;
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => refreshed,
        text: async () => '',
      };
    },
    now: () => 1_100,
    log: () => {},
  });

  const sampled = await provider.ensure(CENTER);
  assert.equal(requests, 1);
  assert.equal(requestedUrl.searchParams.get('topGames'), '4');
  assert.equal(requestedUrl.searchParams.get('recentGames'), '8');
  assert.deepEqual(sampled.topGames, [{ id: 'abcdefgh' }]);
  assert.deepEqual(sampled.recentGames, [{ id: 'ijklmnop' }]);
  assert.equal(typeof stored.explorerRequestProfile, 'string');

  provider.invalidate([CENTER]);
  const reused = await provider.ensure(CENTER);
  assert.equal(requests, 1);
  assert.deepEqual(reused.topGames, [{ id: 'abcdefgh' }]);
  assert.deepEqual(reused.recentGames, [{ id: 'ijklmnop' }]);
});


test('Explorer opening metadata stays source-local instead of becoming canonical position identity', async () => {
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
      json: async () => ({
        ...explorerReading(),
        opening: { eco: 'B14', name: 'Caro-Kann Defense: Panov Attack' },
      }),
      text: async () => '',
    }),
    now: () => 3_000,
    log: () => {},
  });

  const reading = await provider.ensure(CENTER);
  assert.equal(reading.opening.name, 'Caro-Kann Defense: Panov Attack');

  const stored = await repository.get(CENTER);
  assert.equal(Object.hasOwn(stored, 'opening'), false);
  assert.equal(stored.explorer.opening.name, 'Caro-Kann Defense: Panov Attack');
});
