import type { AvatarPresetId, BackgroundType } from '../types';

export interface StudioUrlConfig {
  cleanMode: boolean;
  mirrored: boolean | null;
  disableAutoCam: boolean;
  background: { type: BackgroundType; value: string } | null;
  avatarPreset: Exclude<AvatarPresetId, 'custom'> | null;
}

const BG_SHORTCUTS: Record<string, { type: BackgroundType; value: string }> = {
  transparent: { type: 'none', value: 'transparent' },
  none: { type: 'none', value: 'transparent' },
  green: { type: 'gradient', value: '#00b140' },
  chroma: { type: 'gradient', value: '#00b140' },
  blue: { type: 'gradient', value: '#0047bb' },
  matte: { type: 'blur', value: 'rgba(8, 9, 13, 0.72)' },
  obsidian: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
  },
  sakura: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #1b0f26 0%, #3b1947 52%, #111322 100%)',
  },
  aurora: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #0f3443 0%, #1f7a68 50%, #111a22 100%)',
  },
  ocean: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #0b3d91 0%, #0ea5e9 55%, #091324 100%)',
  },
  twilight: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #180c2c 100%)',
  },
  crimson: {
    type: 'gradient',
    value: 'linear-gradient(135deg, #240718 0%, #881337 52%, #12090d 100%)',
  },
};

const VALID_AVATARS = new Set<Exclude<AvatarPresetId, 'custom'>>([
  'sakura',
  'kitsune',
  'neko',
  'cyber',
  'midnight',
]);

/**
 * Parse public URL parameters so streamers can drop EasyVtuber directly into
 * OBS Browser Source or bookmark a custom preset (e.g. `?clean=1&bg=green`).
 */
export function parseStudioUrlParams(search: string): StudioUrlConfig {
  const params = new URLSearchParams(search);
  const cleanMode = params.get('clean') === '1' || params.get('obs') === '1';
  const mirrorRaw = params.get('mirror');
  const mirrored = mirrorRaw === '1' ? true : mirrorRaw === '0' ? false : null;
  const disableAutoCam = params.get('cam') === '0';

  const bgParam = (params.get('bg') ?? '').trim().toLowerCase();
  let background: { type: BackgroundType; value: string } | null = null;
  if (bgParam && bgParam in BG_SHORTCUTS) {
    background = BG_SHORTCUTS[bgParam]!;
  } else if (/^[0-9a-f]{6}$/i.test(bgParam)) {
    background = { type: 'gradient', value: `#${bgParam}` };
  }

  const avatarParam = (params.get('avatar') ?? '').trim().toLowerCase();
  const avatarPreset = VALID_AVATARS.has(avatarParam as Exclude<AvatarPresetId, 'custom'>)
    ? (avatarParam as Exclude<AvatarPresetId, 'custom'>)
    : null;

  return { cleanMode, mirrored, disableAutoCam, background, avatarPreset };
}

export function buildObsBrowserUrl(
  baseHref: string,
  options: { bg: 'transparent' | 'green' | 'blue'; mirrored: boolean; avatarPreset?: string },
): string {
  const url = new URL(baseHref);
  url.search = '';
  url.searchParams.set('clean', '1');
  url.searchParams.set('bg', options.bg);
  if (options.mirrored) {
    url.searchParams.set('mirror', '1');
  }
  if (options.avatarPreset && options.avatarPreset !== 'custom') {
    url.searchParams.set('avatar', options.avatarPreset);
  }
  return url.toString();
}
