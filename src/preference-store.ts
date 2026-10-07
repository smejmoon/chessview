const KEYS = Object.freeze({
  view: 'chessview.view',
  orientation: 'chessview.orientation',
  debug: 'chessview.debug',
  guide: 'chessview.guide',
});

function resolveStorage(storage: Storage | (() => Storage)) {
  return typeof storage === 'function' ? storage() : storage;
}

function readBoolean(storage: Storage | (() => Storage), key: string) {
  return resolveStorage(storage)?.getItem(key) === '1';
}

function writeBoolean(storage: Storage | (() => Storage), key: string, value: unknown) {
  resolveStorage(storage)?.setItem(key, value ? '1' : '0');
  return Boolean(value);
}

export function createPreferenceStore({ storage = () => globalThis.localStorage } = {}) {
  return Object.freeze({
    getView() {
      return resolveStorage(storage)?.getItem(KEYS.view) === 'roots' ? 'roots' : 'lines';
    },

    setView(view: unknown) {
      const value = view === 'roots' ? 'roots' : 'lines';
      resolveStorage(storage)?.setItem(KEYS.view, value);
      return value;
    },

    getOrientation() {
      return resolveStorage(storage)?.getItem(KEYS.orientation) === 'black' ? 'black' : 'white';
    },

    setOrientation(orientation: unknown) {
      const value = orientation === 'black' ? 'black' : 'white';
      resolveStorage(storage)?.setItem(KEYS.orientation, value);
      return value;
    },

    getDebug() {
      return readBoolean(storage, KEYS.debug);
    },

    setDebug(enabled: unknown) {
      return writeBoolean(storage, KEYS.debug, enabled);
    },

    getGuide() {
      return readBoolean(storage, KEYS.guide);
    },

    setGuide(enabled: unknown) {
      return writeBoolean(storage, KEYS.guide, enabled);
    },
  });
}

export const preferenceStore = createPreferenceStore();
