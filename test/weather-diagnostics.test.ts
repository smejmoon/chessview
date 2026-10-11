import assert from 'node:assert/strict';
import test from 'node:test';
import { decorateWeatherDiagnostics, weatherMeasureLabels } from '../src/weather-diagnostics.ts';

function view() {
  return {
    settling: true,
    structure: { status: 'ready' },
    weather: {
      structure: 'ready',
      frontier: 3,
      structural: {
        working: 1,
        satisfied: 0,
        incorporationPending: 1,
        unavailable: 1,
        failed: 0,
        unplanned: 0,
        detached: 0,
      },
      supplementary: { active: 2, total: 5 },
    },
  };
}

test('Weather diagnostic labels expose independent measures', () => {
  assert.deepEqual(weatherMeasureLabels(view()), [
    'map ready',
    'settling yes',
    'frontier 3',
    'working 1',
    'satisfied 0',
    'incorporating 1',
    'unavailable 1',
    'failed 0',
    'unplanned 0',
    'detached 0',
    'supplementary 2/5',
  ]);
});

test('Weather diagnostics decorate only Debug presentation', () => {
  const status = {
    dataset: {},
    ownerDocument: null,
    child: null,
    querySelector(selector) { return selector === '.view-status-measures' ? this.child : null; },
    appendChild(child) { this.child = child; child.parent = this; },
  };
  status.ownerDocument = {
    createElement() {
      return {
        className: '',
        textContent: '',
        title: '',
        children: [],
        setAttribute() {},
        appendChild(child) { this.children.push(child); child.parent = this; },
        remove() { if (this.parent?.child === this) this.parent.child = null; },
      };
    },
  };
  const app = { querySelector: (selector) => selector === '#view-status' ? status : null };

  assert.equal(decorateWeatherDiagnostics(app, view(), { debug: true }), true);
  assert.equal(status.dataset.weatherDiagnostics, 'true');
  assert.equal(status.child.children.length, 11);
  const frontier = status.child.children.find((item) => item.textContent === 'frontier 3');
  const incorporating = status.child.children.find((item) => item.textContent === 'incorporating 1');
  const supplementary = status.child.children.find((item) => item.textContent === 'supplementary 2/5');
  assert.match(frontier.title, /Explorer Readings/);
  assert.match(incorporating.title, /settlement recomposition/);
  assert.match(supplementary.title, /Non-structural background work/);

  assert.equal(decorateWeatherDiagnostics(app, view(), { debug: false }), true);
  assert.equal(status.dataset.weatherDiagnostics, 'false');
  assert.equal(status.child, null);
});
