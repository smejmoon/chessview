import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const style = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
const statusStyle = await readFile(new URL('../src/lichess-eval-presentation.css', import.meta.url), 'utf8');
const entrypoint = await readFile(new URL('../src/main.ts', import.meta.url), 'utf8');

test('compact layout hides idle source label but keeps active LichessEval status visible', () => {
  const compactBase = style.match(/@media \(max-width: 760px\) \{([\s\S]*)\}\s*$/)?.[1] ?? '';
  assert.match(compactBase, /\.network-status \{ display: none; \}/);

  const compactStatus = statusStyle.match(/@media \(max-width: 760px\) \{([\s\S]*?)\}/)?.[1] ?? '';
  assert.match(compactStatus, /\.network-status\.is-loading/);
  assert.match(compactStatus, /\.network-status\.is-issue/);
  assert.match(compactStatus, /display: inline;/);

  assert.ok(
    entrypoint.indexOf("import './style.css';")
      < entrypoint.indexOf("import './lichess-eval-presentation.css';"),
    'status overrides must load after the base responsive rule',
  );
});
