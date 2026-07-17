import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';

import {
  LOCALE_STORAGE_KEY,
  getStoredLocale,
  setStoredLocale,
  resolveInitialLocale,
} from '../src/i18n/localePreference.ts';

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('resolveInitialLocale (pure, DOM-free)', () => {
  it('returns the valid stored locale, ignoring detected languages', () => {
    assert.equal(resolveInitialLocale('en-US', ['pt-BR']), 'en-US');
  });

  it('falls back to resolveSupportedLocale for an invalid stored value', () => {
    assert.equal(resolveInitialLocale('fr-FR', ['es-PY']), 'es-PY');
  });

  it('falls back to resolveSupportedLocale for an empty stored value', () => {
    assert.equal(resolveInitialLocale('', ['en-US']), 'en-US');
  });

  it('falls back to resolveSupportedLocale for a null stored value', () => {
    assert.equal(resolveInitialLocale(null, ['pt-BR']), 'pt-BR');
  });

  it('falls back to resolveSupportedLocale for an undefined stored value', () => {
    assert.equal(resolveInitialLocale(undefined, []), 'pt-BR');
  });

  it('precedence: a valid stored locale wins even when languages resolve differently', () => {
    assert.equal(resolveInitialLocale('en-US', ['pt-BR', 'es-PY']), 'en-US');
  });
});

describe('getStoredLocale / setStoredLocale', () => {
  let previousLocalStorage: unknown;
  const hadOwnProperty = Object.prototype.hasOwnProperty.call(globalThis, 'localStorage');

  before(() => {
    previousLocalStorage = (globalThis as { localStorage?: unknown }).localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
  });

  after(() => {
    if (hadOwnProperty) {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: previousLocalStorage,
      });
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('setStoredLocale then getStoredLocale round-trips a valid locale', () => {
    setStoredLocale('es-PY');
    assert.equal(getStoredLocale(), 'es-PY');
  });

  it('getStoredLocale returns null when nothing is stored', () => {
    (globalThis.localStorage as MemoryStorage).clear();
    assert.equal(getStoredLocale(), null);
  });

  it('getStoredLocale returns null for an unrecognized stored value', () => {
    globalThis.localStorage.setItem(LOCALE_STORAGE_KEY, 'fr-FR');
    assert.equal(getStoredLocale(), null);
  });

  it('getStoredLocale returns null for an empty stored value', () => {
    globalThis.localStorage.setItem(LOCALE_STORAGE_KEY, '');
    assert.equal(getStoredLocale(), null);
  });

  it('getStoredLocale returns null when localStorage access throws', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('access denied');
      },
    });

    assert.equal(getStoredLocale(), null);

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    });
  });
});
