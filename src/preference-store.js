const KEYS = Object.freeze({
  view: 'chessview.view',
  orientation: 'chessview.orientation',
  debug: 'chessview.debug',
  guide: 'chessview.guide',
});

function resolveStorage(storage) {
  return typeof storage === 'function' ? storage() : storage;
}

function readBoolean(storage, key) {
  return resolveStorage(storage)?.getItem(key) === '1';
}

function writeBoolean(storage, key, value) {
  resolveStorage(storage)?.setItem(key, value ? '1' : '0');
  return Boolean(value);
}

export function createPreferenceStore({ storage = () => globalThis.localStorage } = {}) {
  return Object.freeze({
    getView() {
      return resolveStorage(storage)?.getItem(KEYS.view) === 'roots' ? 'roots' : 'lines';
    },

    setView(view) {
      const value = view === 'roots' ? 'roots' : 'lines';
      resolveStorage(storage)?.setItem(KEYS.view, value);
      return value;
    },

    getOrientation() {
      return resolveStorage(storage)?.getItem(KEYS.orientation) === 'black' ? 'black' : 'white';
    },

    setOrientation(orientation) {
      const value = orientation === 'black' ? 'black' : 'white';
      resolveStorage(storage)?.setItem(KEYS.orientation, value);
      return value;
    },

    getDebug() {
      return readBoolean(storage, KEYS.debug);
    },

    setDebug(enabled) {
      return writeBoolean(storage, KEYS.debug, enabled);
    },

    getGuide() {
      return readBoolean(storage, KEYS.guide);
    },

    setGuide(enabled) {
      return writeBoolean(storage, KEYS.guide, enabled);
    },
  });
}

export const preferenceStore = createPreferenceStore();
