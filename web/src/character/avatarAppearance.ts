import type { AvatarAccessory, AvatarAppearance, AvatarPresetId } from '../types';
import {
  COL_HAIR,
  COL_HAIR_DARK,
  COL_HAIR_LIGHT,
  COL_IRIS,
  COL_IRIS_DARK,
  COL_SKIN,
  COL_SKIN_SHADE,
} from './spec';

const APPEARANCE_STORAGE_KEY = 'easyvtuber.appearance.v1';

const VALID_ACCESSORIES: readonly AvatarAccessory[] = [
  'none',
  'fox-ears',
  'cat-ears',
  'halo',
  'glasses',
  'horns',
];

const VALID_PRESETS: readonly AvatarPresetId[] = [
  'sakura',
  'kitsune',
  'neko',
  'cyber',
  'midnight',
  'custom',
];

export const AVATAR_PRESETS: Record<Exclude<AvatarPresetId, 'custom'>, AvatarAppearance> = {
  sakura: {
    presetId: 'sakura',
    hairColor: COL_HAIR,
    hairDark: COL_HAIR_DARK,
    hairLight: COL_HAIR_LIGHT,
    eyeColor: COL_IRIS,
    eyeDark: COL_IRIS_DARK,
    skinColor: COL_SKIN,
    skinShade: COL_SKIN_SHADE,
    outfitColor: '#2a1f36',
    outfitAccent: '#f472b6',
    accessory: 'none',
  },
  kitsune: {
    presetId: 'kitsune',
    hairColor: '#f48fb1',
    hairDark: '#c2557d',
    hairLight: '#ffc1d6',
    eyeColor: '#b76ee8',
    eyeDark: '#6b2899',
    skinColor: '#fff0e8',
    skinShade: '#f5d2c4',
    outfitColor: '#f8fafc',
    outfitAccent: '#dc2626',
    accessory: 'fox-ears',
  },
  neko: {
    presetId: 'neko',
    hairColor: '#5b8def',
    hairDark: '#335db8',
    hairLight: '#93b8ff',
    eyeColor: '#f59e0b',
    eyeDark: '#b45309',
    skinColor: '#ffe5d9',
    skinShade: '#f8c9b8',
    outfitColor: '#1e293b',
    outfitAccent: '#38bdf8',
    accessory: 'cat-ears',
  },
  cyber: {
    presetId: 'cyber',
    hairColor: '#22d3ee',
    hairDark: '#0e7490',
    hairLight: '#a5f3fc',
    eyeColor: '#ec4899',
    eyeDark: '#9d174d',
    skinColor: '#fce4da',
    skinShade: '#edc3b4',
    outfitColor: '#14172a',
    outfitAccent: '#8b5cf6',
    accessory: 'glasses',
  },
  midnight: {
    presetId: 'midnight',
    hairColor: '#2d2438',
    hairDark: '#16111d',
    hairLight: '#5a4a70',
    eyeColor: '#ef4444',
    eyeDark: '#991b1b',
    skinColor: '#f7e7e2',
    skinShade: '#e3c7be',
    outfitColor: '#18131d',
    outfitAccent: '#e11d48',
    accessory: 'horns',
  },
};

export const DEFAULT_AVATAR_APPEARANCE: AvatarAppearance = AVATAR_PRESETS.sakura;

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Shift a `#rrggbb` hex color brighter (delta > 0) or darker (delta < 0). */
export function shadeHex(hex: string, factor: number): string {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const mix = (channel: number) =>
    factor >= 0 ? channel + (255 - channel) * factor : channel * (1 + factor);
  const toHex = (n: number) => clampByte(n).toString(16).padStart(2, '0');
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

function sanitizeHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

export function sanitizeAppearance(raw: unknown): AvatarAppearance {
  if (!raw || typeof raw !== 'object') return DEFAULT_AVATAR_APPEARANCE;
  const obj = raw as Record<string, unknown>;
  const presetId = VALID_PRESETS.includes(obj.presetId as AvatarPresetId)
    ? (obj.presetId as AvatarPresetId)
    : 'custom';
  const base = presetId !== 'custom' ? AVATAR_PRESETS[presetId] : DEFAULT_AVATAR_APPEARANCE;
  const hairColor = sanitizeHex(obj.hairColor, base.hairColor);
  const eyeColor = sanitizeHex(obj.eyeColor, base.eyeColor);
  const skinColor = sanitizeHex(obj.skinColor, base.skinColor);
  return {
    presetId,
    hairColor,
    hairDark: sanitizeHex(obj.hairDark, shadeHex(hairColor, -0.26)),
    hairLight: sanitizeHex(obj.hairLight, shadeHex(hairColor, 0.34)),
    eyeColor,
    eyeDark: sanitizeHex(obj.eyeDark, shadeHex(eyeColor, -0.35)),
    skinColor,
    skinShade: sanitizeHex(obj.skinShade, shadeHex(skinColor, -0.1)),
    outfitColor: sanitizeHex(obj.outfitColor, base.outfitColor),
    outfitAccent: sanitizeHex(obj.outfitAccent, base.outfitAccent),
    accessory: VALID_ACCESSORIES.includes(obj.accessory as AvatarAccessory)
      ? (obj.accessory as AvatarAccessory)
      : base.accessory,
  };
}

export function readAppearance(): AvatarAppearance {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_AVATAR_APPEARANCE;
    const raw = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_AVATAR_APPEARANCE;
    return sanitizeAppearance(JSON.parse(raw));
  } catch {
    return DEFAULT_AVATAR_APPEARANCE;
  }
}

export function writeAppearance(appearance: AvatarAppearance): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(appearance));
  } catch {
    // Ignore storage quota / privacy mode errors.
  }
}
