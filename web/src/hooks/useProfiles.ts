import { useCallback, useState } from 'react';
import type {
  BackgroundType,
  OverlayItem,
  StageCameraConfig,
  StageLightingConfig,
  StudioProfile,
  StudioProfileData,
  TrackingTuning,
} from '../types';

const PROFILES_STORAGE_KEY = 'easyvtuber.profiles.v1';
const MAX_PROFILES = 24;

const clamp = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;

const str = (v: unknown, fallback: string, maxLen = 200): string =>
  typeof v === 'string' && v.length <= maxLen ? v : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

export const DEFAULT_STAGE_CAMERA: StageCameraConfig = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  orbitYaw: 0,
};

export const LIGHTING_PRESETS: Record<StageLightingConfig['preset'], StageLightingConfig> = {
  studio: {
    preset: 'studio',
    keyIntensity: 1.3,
    rimIntensity: 0.75,
    ambientIntensity: 0.85,
    keyColor: '#fff5ef',
    rimColor: '#f472b6',
  },
  neon: {
    preset: 'neon',
    keyIntensity: 1.25,
    rimIntensity: 1.45,
    ambientIntensity: 0.55,
    keyColor: '#e0f2fe',
    rimColor: '#a855f7',
  },
  sunset: {
    preset: 'sunset',
    keyIntensity: 1.45,
    rimIntensity: 0.95,
    ambientIntensity: 0.7,
    keyColor: '#ffedd5',
    rimColor: '#fb7185',
  },
  moonlight: {
    preset: 'moonlight',
    keyIntensity: 1.1,
    rimIntensity: 1.15,
    ambientIntensity: 0.55,
    keyColor: '#dbeafe',
    rimColor: '#60a5fa',
  },
};

const VALID_BG_TYPES: readonly BackgroundType[] = ['none', 'gradient', 'blur', 'image'];
const VALID_LIGHT_PRESETS: readonly StageLightingConfig['preset'][] = [
  'studio',
  'neon',
  'sunset',
  'moonlight',
];

function sanitizeHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

function sanitizeOverlays(raw: unknown): OverlayItem[] {
  if (!Array.isArray(raw)) return [];
  const out: OverlayItem[] = [];
  for (const item of raw.slice(0, 24)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const type = obj.type;
    if (type !== 'emoji' && type !== 'text' && type !== 'image') continue;
    const content = typeof obj.content === 'string' ? obj.content : '';
    if (type === 'image' && !/^data:image\//i.test(content)) continue;
    if (type !== 'image' && content.length > 80) continue;
    out.push({
      id: str(obj.id, `overlay-${out.length}`, 64),
      type,
      content,
      x: clamp(obj.x, 0.05, 0.95, 0.5),
      y: clamp(obj.y, 0.05, 0.95, 0.5),
      scale: clamp(obj.scale, 0.4, 3, 1),
      rotation: clamp(obj.rotation, -180, 180, 0),
      opacity: clamp(obj.opacity, 0, 1, 1),
    });
  }
  return out;
}

export function sanitizeProfileData(raw: unknown): StudioProfileData | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const expr = (obj.expression ?? {}) as Record<string, unknown>;
  const cam = (obj.camera ?? {}) as Record<string, unknown>;
  const light = (obj.lighting ?? {}) as Record<string, unknown>;
  const tune = (obj.tuning ?? {}) as Record<string, unknown>;

  const background = VALID_BG_TYPES.includes(obj.background as BackgroundType)
    ? (obj.background as BackgroundType)
    : 'gradient';
  const rawBgVal = typeof obj.backgroundValue === 'string' ? obj.backgroundValue : '';
  const backgroundValue =
    background === 'image'
      ? /^data:image\//i.test(rawBgVal)
        ? rawBgVal
        : 'transparent'
      : str(rawBgVal, 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)', 300);

  const preset = VALID_LIGHT_PRESETS.includes(light.preset as StageLightingConfig['preset'])
    ? (light.preset as StageLightingConfig['preset'])
    : 'studio';

  const tuning: TrackingTuning = {
    headSensitivity: clamp(tune.headSensitivity, 0.25, 2.5, 1),
    smoothing: clamp(tune.smoothing, 0, 0.92, 0.55),
    autoBlink: bool(tune.autoBlink, true),
    idleBreathing: bool(tune.idleBreathing, true),
  };

  return {
    expression: {
      mouthOpen: clamp(expr.mouthOpen, 0, 1, 0),
      eyebrowRaise: clamp(expr.eyebrowRaise, 0, 1, 0),
      eyeSmile: clamp(expr.eyeSmile, 0, 1, 0),
      cheekPuff: clamp(expr.cheekPuff, 0, 1, 0),
      angry: clamp(expr.angry, 0, 1, 0),
      sad: clamp(expr.sad, 0, 1, 0),
      relaxed: clamp(expr.relaxed, 0, 1, 0),
    },
    background,
    backgroundValue,
    overlays: sanitizeOverlays(obj.overlays),
    camera: {
      zoom: clamp(cam.zoom, 0.5, 2.5, 1),
      offsetX: clamp(cam.offsetX, -0.4, 0.4, 0),
      offsetY: clamp(cam.offsetY, -0.4, 0.4, 0),
      orbitYaw: clamp(cam.orbitYaw, -45, 45, 0),
    },
    lighting: {
      preset,
      keyIntensity: clamp(light.keyIntensity, 0, 3, LIGHTING_PRESETS[preset].keyIntensity),
      rimIntensity: clamp(light.rimIntensity, 0, 3, LIGHTING_PRESETS[preset].rimIntensity),
      ambientIntensity: clamp(
        light.ambientIntensity,
        0,
        2,
        LIGHTING_PRESETS[preset].ambientIntensity,
      ),
      keyColor: sanitizeHex(light.keyColor, LIGHTING_PRESETS[preset].keyColor),
      rimColor: sanitizeHex(light.rimColor, LIGHTING_PRESETS[preset].rimColor),
    },
    tuning,
    mirrored: bool(obj.mirrored, false),
  };
}

export function parseProfileJson(jsonText: string): { name: string; data: StudioProfileData } {
  const parsed = JSON.parse(jsonText) as Record<string, unknown> | null;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Profile JSON must be an object.');
  }
  const name = str(parsed.name, 'Imported Profile', 48).trim() || 'Imported Profile';
  const payload = 'data' in parsed ? parsed.data : parsed;
  const data = sanitizeProfileData(payload);
  if (!data) {
    throw new Error('Invalid profile data payload.');
  }
  return { name, data };
}

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readProfiles(): StudioProfile[] {
  const store = getStorage();
  if (!store) return [];
  try {
    const raw = store.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const profiles: StudioProfile[] = [];
    for (const item of parsed.slice(0, MAX_PROFILES)) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const data = sanitizeProfileData(obj.data);
      const name = str(obj.name, '', 48).trim();
      if (!data || !name) continue;
      profiles.push({
        id: str(obj.id, `profile-${profiles.length}`, 64),
        name,
        updatedAt: typeof obj.updatedAt === 'number' ? obj.updatedAt : Date.now(),
        data,
      });
    }
    return profiles;
  } catch {
    return [];
  }
}

function writeProfiles(profiles: StudioProfile[]): void {
  const store = getStorage();
  if (!store) return;
  try {
    store.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch {
    // Storage quota exceeded — ignore gracefully.
  }
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<StudioProfile[]>(readProfiles);

  const saveProfile = useCallback((name: string, data: StudioProfileData): StudioProfile => {
    const cleanName = name.trim().slice(0, 48) || 'Untitled Scene';
    const now = Date.now();
    let saved!: StudioProfile;
    setProfiles((prev) => {
      const existing = prev.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());
      saved = {
        id: existing?.id ?? `profile-${now}-${Math.random().toString(36).slice(2, 6)}`,
        name: cleanName,
        updatedAt: now,
        data,
      };
      const next = [saved, ...prev.filter((p) => p.id !== saved.id)].slice(0, MAX_PROFILES);
      writeProfiles(next);
      return next;
    });
    return saved;
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeProfiles(next);
      return next;
    });
  }, []);

  return { profiles, saveProfile, deleteProfile };
}
