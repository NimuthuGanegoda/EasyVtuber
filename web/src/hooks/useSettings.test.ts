import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, isMaxFps, readSettings, writeSettings } from './useSettings';

function installStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => data.clear(),
    key: (i: number) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  } as unknown as Storage;
  vi.stubGlobal('window', { localStorage: storage });
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readSettings', () => {
  it('returns defaults when nothing is stored', () => {
    installStorage();
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when storage is unavailable', () => {
    vi.stubGlobal('window', undefined);
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips persisted settings', () => {
    installStorage();
    const settings = { ...DEFAULT_SETTINGS, maxFps: 60 as const, delegate: 'CPU' as const };
    writeSettings(settings);
    expect(readSettings()).toEqual(settings);
  });

  it('ignores unknown values instead of trusting the payload', () => {
    installStorage({
      'easyvtuber.settings.v1': JSON.stringify({
        maxFps: 999,
        delegate: 'TPU',
        deviceId: '',
        showDebug: 'yes',
      }),
    });
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('survives corrupt JSON', () => {
    installStorage({ 'easyvtuber.settings.v1': '{not json' });
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('isMaxFps', () => {
  it('accepts only the offered choices', () => {
    expect(isMaxFps(30)).toBe(true);
    expect(isMaxFps(15)).toBe(true);
    expect(isMaxFps(60)).toBe(true);
    expect(isMaxFps(24)).toBe(false);
    expect(isMaxFps('30')).toBe(false);
  });
});
