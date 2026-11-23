import { describe, expect, it, vi } from 'vitest';
import {
  AVATAR_PRESETS,
  DEFAULT_AVATAR_APPEARANCE,
  sanitizeAppearance,
  shadeHex,
} from '../character/avatarAppearance';
import {
  DEFAULT_PNG_AVATAR_CONFIG,
  drawPngAvatar,
  type PngRenderState,
} from '../character/pngAvatar';
import { drawStageBackdrop } from './stageComposite';
import { buildObsBrowserUrl, parseStudioUrlParams } from './urlParams';

describe('parseStudioUrlParams & buildObsBrowserUrl', () => {
  it('parses clean OBS params, chroma backdrop, mirror, cam=0, and avatar preset', () => {
    const cfg = parseStudioUrlParams('?clean=1&bg=green&mirror=1&cam=0&avatar=kitsune');
    expect(cfg.cleanMode).toBe(true);
    expect(cfg.mirrored).toBe(true);
    expect(cfg.disableAutoCam).toBe(true);
    expect(cfg.background).toEqual({ type: 'gradient', value: '#00b140' });
    expect(cfg.avatarPreset).toBe('kitsune');
  });

  it('accepts custom 6-digit hex colors and ignores unknown presets', () => {
    const cfg = parseStudioUrlParams('?bg=1a2b3c&avatar=unknown');
    expect(cfg.background).toEqual({ type: 'gradient', value: '#1a2b3c' });
    expect(cfg.avatarPreset).toBeNull();
  });

  it('builds a clean OBS Browser Source URL', () => {
    const built = buildObsBrowserUrl('https://example.com/EasyVtuber/?foo=bar', {
      bg: 'transparent',
      mirrored: true,
      avatarPreset: 'neko',
    });
    const parsed = new URL(built);
    expect(parsed.searchParams.get('clean')).toBe('1');
    expect(parsed.searchParams.get('bg')).toBe('transparent');
    expect(parsed.searchParams.get('mirror')).toBe('1');
    expect(parsed.searchParams.get('avatar')).toBe('neko');
    expect(parsed.searchParams.get('foo')).toBeNull();
  });
});

describe('avatarAppearance helpers', () => {
  it('darkens and lightens hex colors cleanly', () => {
    expect(shadeHex('#808080', -0.5)).toBe('#404040');
    expect(shadeHex('#000000', 0.5)).toBe('#808080');
    expect(shadeHex('bad', 0.2)).toBe('bad');
  });

  it('sanitizes malformed appearance objects safely', () => {
    const safe = sanitizeAppearance({
      presetId: 'kitsune',
      hairColor: 'javascript:bad',
      accessory: 'invalid-accessory',
    });
    expect(safe.hairColor).toBe(AVATAR_PRESETS.kitsune.hairColor);
    expect(safe.accessory).toBe('fox-ears');
    expect(sanitizeAppearance(null)).toEqual(DEFAULT_AVATAR_APPEARANCE);
  });
});

describe('drawStageBackdrop', () => {
  it('leaves canvas clear for transparent mode and fills gradient stops for CSS gradients', () => {
    const addColorStop = vi.fn();
    const fakeGrad = { addColorStop } as unknown as CanvasGradient;
    const ctx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => fakeGrad),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;

    drawStageBackdrop(ctx, 1024, 1024, 'none', 'transparent');
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 1024, 1024);
    expect(ctx.fillRect).not.toHaveBeenCalled();

    drawStageBackdrop(
      ctx,
      1024,
      1024,
      'gradient',
      'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
    );
    expect(ctx.createLinearGradient).toHaveBeenCalled();
    expect(addColorStop).toHaveBeenCalledTimes(3);
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1024, 1024);
  });
});

describe('drawPngAvatar', () => {
  const makeFakeImg = (w = 512, h = 512) =>
    ({ complete: true, naturalWidth: w, naturalHeight: h }) as unknown as HTMLImageElement;

  it('selects idle, talking, and blinking sprites reactively', () => {
    const idle = makeFakeImg();
    const talking = makeFakeImg();
    const blinking = makeFakeImg();
    const drawImage = vi.fn();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    } as unknown as CanvasRenderingContext2D;

    const state: PngRenderState = { bounce: 0, talkPhase: 0 };
    const expr = { mouthOpen: 0, eyebrowRaise: 0, eyeSmile: 0, cheekPuff: 0 };

    // Idle
    expect(
      drawPngAvatar(
        ctx,
        { idle, talking, blinking },
        null,
        expr,
        0,
        DEFAULT_PNG_AVATAR_CONFIG,
        state,
        1000,
      ),
    ).toBe(true);
    expect(drawImage).toHaveBeenLastCalledWith(
      idle,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );

    // Talking via mic audio
    drawPngAvatar(
      ctx,
      { idle, talking, blinking },
      null,
      expr,
      0.7,
      DEFAULT_PNG_AVATAR_CONFIG,
      state,
      1050,
    );
    expect(drawImage).toHaveBeenLastCalledWith(
      talking,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
    expect(state.bounce).toBeGreaterThan(0);

    // Blinking while silent
    drawPngAvatar(
      ctx,
      { idle, talking, blinking },
      {
        eyeLHTemp: 0.9,
        eyeRHTemp: 0.9,
        mouthRatio: 0,
        eyeXRatio: 0,
        eyeYRatio: 0,
        xAngle: 0,
        yAngle: 0,
        zAngle: 0,
        headX: 0,
        headY: 0,
        headZ: 0,
      },
      expr,
      0,
      DEFAULT_PNG_AVATAR_CONFIG,
      state,
      1100,
    );
    expect(drawImage).toHaveBeenLastCalledWith(
      blinking,
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    );
  });
});
