import { useCallback, useState } from 'react';
import type { InferenceDelegate } from '../types';

/**
 * User-facing settings that previously existed only as decorative controls in
 * the Settings tab (they rendered, but nothing read their values). Persisted to
 * localStorage so a stream setup survives a reload.
 */

export const MAX_FPS_CHOICES = [15, 30, 60] as const;
export type MaxFps = (typeof MAX_FPS_CHOICES)[number];

export interface Settings {
  delegate: InferenceDelegate;
  /** Exact `MediaDeviceInfo.deviceId`, or null for the system default. */
  deviceId: string | null;
  maxFps: MaxFps;
  showDebug: boolean;
  autoStart: boolean;
}

const STORAGE_KEY = 'easyvtuber.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  delegate: 'GPU',
  deviceId: null,
  maxFps: 30,
  showDebug: true,
  autoStart: true,
};

export function isMaxFps(value: unknown): value is MaxFps {
  return typeof value === 'number' && (MAX_FPS_CHOICES as readonly number[]).includes(value);
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    // Blocked by privacy settings / sandboxed iframe.
    return null;
  }
}

export function readSettings(): Settings {
  const store = storage();
  if (!store) return DEFAULT_SETTINGS;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<Settings> | null;
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS;
    return {
      delegate: parsed.delegate === 'CPU' ? 'CPU' : 'GPU',
      deviceId: typeof parsed.deviceId === 'string' && parsed.deviceId ? parsed.deviceId : null,
      maxFps: isMaxFps(parsed.maxFps) ? parsed.maxFps : DEFAULT_SETTINGS.maxFps,
      showDebug:
        typeof parsed.showDebug === 'boolean' ? parsed.showDebug : DEFAULT_SETTINGS.showDebug,
      autoStart:
        typeof parsed.autoStart === 'boolean' ? parsed.autoStart : DEFAULT_SETTINGS.autoStart,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeSettings(settings: Settings): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota exceeded / storage disabled — settings simply won't persist.
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(readSettings);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      writeSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
