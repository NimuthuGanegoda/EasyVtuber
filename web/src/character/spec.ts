/**
 * Single source of truth for the procedural avatar's geometry and palette.
 *
 * Both renderers consume this file: the Canvas 2D path in
 * `character/canvas2d.ts` and the WebGL path in `utils/webglRenderer.ts`.
 * They used to keep private copies of every constant with a "mirrored from
 * App.tsx" comment, and the copies had already drifted (blush radius 17 vs
 * 13, different cheek-puff gains), so the two renderers did not actually
 * look the same. Do not reintroduce a local copy — import from here.
 */

/** Logical canvas size. Both renderers render at this size and are composited 1:1. */
export const CANVAS_SIZE = 512;

// Layout (all in canvas pixels, relative to the head center)
export const CHAR_CENTER_X = 256;
export const CHAR_CENTER_Y = 230;
export const HEAD_R = 66;
export const EYE_SPACING = 24;
export const EYE_W = 13;
export const EYE_H = 16;
export const PUPIL_R = 4;
export const IRIS_R = 8.6;
/** Relative to head center. */
export const MOUTH_Y = 34;
export const MOUTH_MAX_W = 20;
export const BLUSH_R = 17;
export const BLUSH_PUFF_GAIN = 10;

// Head-pose → pixel mapping. Same gains for both renderers so the head moves
// identically whichever one is active.
export const HEAD_TILT_GAIN = 40;
export const HEAD_TURN_GAIN = 30;
export const HEAD_ROLL_GAIN = 6;

// Palette
export const COL_SKIN = '#ffe3d6';
export const COL_SKIN_SHADE = '#ffcbb8';
export const COL_HAIR = '#ff5c94';
export const COL_HAIR_DARK = '#d63d75';
export const COL_HAIR_LIGHT = '#ff9dc0';
export const COL_IRIS = '#a34fd6';
export const COL_IRIS_DARK = '#6b2a94';
export const COL_PUPIL = '#2a1030';
export const COL_OUTLINE = '#5c2c47';
export const COL_MOUTH = '#c23f6b';
export const COL_MOUTH_INNER = '#7a1f3d';

export type Rgba = [number, number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Convert a `#rgb` / `#rrggbb` string to the float RGBA tuple WebGL uniforms need. */
export function toRgba(hex: string, alpha = 1): Rgba {
  const raw = hex.replace('#', '');
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw;
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value) || full.length !== 6) {
    return [0, 0, 0, clamp01(alpha)];
  }
  return [
    ((value >> 16) & 0xff) / 255,
    ((value >> 8) & 0xff) / 255,
    (value & 0xff) / 255,
    clamp01(alpha),
  ];
}

/** Blur radius of the cheek blush, grown by the manual "cheek puff" toggle. */
export function blushRadius(cheekPuff: number): number {
  return BLUSH_R + clamp01(cheekPuff) * BLUSH_PUFF_GAIN;
}

/** Eye openness (0 = shut, 1 = wide) derived from the tracked blink values. */
export function eyeOpenness(
  blinkClosedLeft: number,
  blinkClosedRight: number,
): { left: number; right: number } {
  // Never fully shut: a 0-height ellipse makes the iris clip away entirely and
  // the eye visibly "pops" on the frame it reopens.
  return {
    left: Math.max(0.06, 1 - blinkClosedLeft),
    right: Math.max(0.06, 1 - blinkClosedRight),
  };
}

/** Iris/pupil offset in pixels, clamped so the iris can't slide out of the eye. */
export function eyeOffsets(eyeXRatio: number, eyeYRatio: number): { x: number; y: number } {
  return {
    x: Math.max(-4, Math.min(4, eyeXRatio * 3)),
    y: Math.max(-3, Math.min(3, eyeYRatio * 3)),
  };
}

/**
 * Mouth opening in pixels. Tracked mouth wins over the manual override unless
 * the override is bigger (it is a deliberate "force the mouth open" control).
 */
export function mouthOpening(mouthRatio: number | null, manualOpen: number): number {
  const tracked = mouthRatio === null ? 0 : Math.min(mouthRatio * 26, 22);
  return Math.max(tracked, clamp01(manualOpen) * 18);
}
