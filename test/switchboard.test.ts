import assert from 'node:assert/strict';
import test from 'node:test';
import { switchboard } from '../src/switchboard.ts';

function input(mode, structure) {
  return { center: 'A', mode, structure, signal: new AbortController().signal };
}

function task(tasks, key) {
  const match = tasks.find((item) => item.key === key);
  assert.ok(match, `Expected task ${key}`);
  return match;
}

test('Switchboard binds Root demand to stable task keys and source work', () => {
  const request = input('roots', {
    readingFrontier: ['B'],
    composition: {
      nodes: [{ key: 'C' }],
      relationships: [{ edge: { source: 'C', target: 'A' } }],
    },
  });
  const tasks = switchboard(request);

  assert.deepEqual(tasks.map(({ key }) => key), [
    'root-discovery:A',
    'root-transpositions:A',
    'explorer:B',
    'explorer:C',
    'explorer:A',
    'cloud-eval:C',
    'cloud-eval:A',
    'masters:C',
    'masters:A',
  ]);
  assert.equal(new Set(tasks.map(({ key }) => key)).size, tasks.length);
  assert.ok(tasks.every((item) => typeof item.run === 'function'));

  assert.equal(task(tasks, 'root-discovery:A').purpose, 'root-discovery');
  assert.deepEqual(task(tasks, 'root-discovery:A').modes, ['roots']);
  assert.equal(task(tasks, 'root-transpositions:A').nodusWide, true);

  assert.deepEqual(task(tasks, 'explorer:B').modes, ['roots']);
  assert.equal(task(tasks, 'explorer:B').structuralReading, 'B');
  assert.equal(task(tasks, 'explorer:C').structuralReading, null);
  assert.equal(task(tasks, 'explorer:A').nodusWide, true);
  assert.equal(task(tasks, 'cloud-eval:A').nodusWide, true);
  assert.equal(task(tasks, 'masters:A').nodusWide, true);
  assert.equal(Object.hasOwn(task(tasks, 'cloud-eval:C'), 'structuralReading'), false);
  assert.equal(Object.hasOwn(task(tasks, 'masters:C'), 'structuralReading'), false);

  // Replanning describes the same participation without launching acquisition.
  assert.deepEqual(switchboard(request).map(({ key }) => key), tasks.map(({ key }) => key));
});

test('Switchboard nominates Root bootstrap even before topology; transposition waits', () => {
  const tasks = switchboard(input('roots', null));
  assert.equal(task(tasks, 'root-discovery:A').purpose, 'root-discovery');
  assert.equal(tasks.some(({ key }) => key.startsWith('root-transpositions:')), false);
  assert.equal(task(tasks, 'explorer:A').nodusWide, true);
});

test('Switchboard does not nominate Root-specific work for Lines', () => {
  const tasks = switchboard(input('lines', {
    readingFrontier: ['B'],
    composition: {
      nodes: [{ key: 'C' }],
      relationships: [{ edge: { source: 'C', target: 'A' } }],
    },
  }));
  assert.equal(tasks.some(({ key }) => key.startsWith('root-discovery:')), false);
  assert.equal(tasks.some(({ key }) => key.startsWith('root-transpositions:')), false);
  assert.equal(task(tasks, 'explorer:B').structuralReading, 'B');
  assert.deepEqual(task(tasks, 'explorer:B').modes, ['lines']);
});
