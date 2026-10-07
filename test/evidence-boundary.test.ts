import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function source(path) {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

test('Evidence owns semantic reads without depending on Constellation', () => {
  const evidence = source('../src/evidence-source.ts');
  assert.doesNotMatch(evidence, /constellation/i);
  assert.doesNotMatch(evidence, /visible-graph/);
  assert.doesNotMatch(evidence, /nodus-structure/);
});

test('Constellation requests Evidence instead of deriving provider evidence directly', () => {
  const structure = source('../src/nodus-structure.ts');
  assert.match(structure, /createEvidenceReader/);
  assert.doesNotMatch(structure, /from '\.\/evidence\.js'/);
  assert.doesNotMatch(structure, /from '\.\/explorer\.js'/);
  assert.doesNotMatch(structure, /from '\.\/lichess-eval\.js'/);
  assert.doesNotMatch(structure, /from '\.\/masters\.js'/);
});

test('joining Evidence to visible relationship identity is presentation glue, not Evidence', () => {
  const projection = source('../src/evidence-presentation.ts');
  assert.match(projection, /createEvidenceReader/);
  assert.match(projection, /relationship\.id/);
  assert.match(projection, /relationship\.edge/);
});
