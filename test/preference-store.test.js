import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreferenceStore } from '../src/preference-store.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

test('PreferenceStore supplies domain defaults without making storage live state', () => {
  const storage = new MemoryStorage();
  const preferences = createPreferenceStore({ storage });
  assert.equal(preferences.getView(), 'lines');
  assert.equal(preferences.getOrientation(), 'white');
  assert.equal(preferences.getDebug(), false);
  assert.equal(preferences.getGuide(), false);
});

test('PreferenceStore persists validated ChessView choices', () => {
  const storage = new MemoryStorage();
  const preferences = createPreferenceStore({ storage });

  assert.equal(preferences.setView('roots'), 'roots');
  assert.equal(preferences.setOrientation('black'), 'black');
  assert.equal(preferences.setDebug(true), true);
  assert.equal(preferences.setGuide(true), true);

  assert.equal(preferences.getView(), 'roots');
  assert.equal(preferences.getOrientation(), 'black');
  assert.equal(preferences.getDebug(), true);
  assert.equal(preferences.getGuide(), true);
});

test('invalid enumerated choices normalize to safe defaults', () => {
  const storage = new MemoryStorage();
  const preferences = createPreferenceStore({ storage });
  assert.equal(preferences.setView('sideways'), 'lines');
  assert.equal(preferences.setOrientation('upside-down'), 'white');
});
