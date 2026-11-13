import { describe, expect, it } from 'vitest';
import { BLUSH_R, blushRadius, eyeOffsets, eyeOpenness, mouthOpening, toRgba } from './spec';
import { smoothPose } from './canvas2d';
import type { PoseData } from '../utils/poseExtractor';

describe('toRgba', () => {
  it('converts 6-digit hex to normalized floats', () => {
    expect(toRgba('#ff5c94', 1)).toEqual([1, 0x5c / 255, 0x94 / 255, 1]);
  });

  it('expands 3-digit hex', () => {
    expect(toRgba('#f00')).toEqual([1, 0, 0, 1]);
  });

  it('clamps alpha into 0..1', () => {
    expect(toRgba('#000000', 2)[3]).toBe(1);
    expect(toRgba('#000000', -1)[3]).toBe(0);
  });

  it('returns an opaque-safe fallback for malformed input', () => {
    expect(toRgba('not-a-colour', 1)).toEqual([0, 0, 0, 1]);
  });
});

describe('blushRadius', () => {
  it('grows with the cheek-puff override and never shrinks below the base', () => {
    expect(blushRadius(0)).toBe(BLUSH_R);
    expect(blushRadius(1)).toBeGreaterThan(BLUSH_R);
    expect(blushRadius(5)).toBe(blushRadius(1));
    expect(blushRadius(-1)).toBe(BLUSH_R);
  });
});

describe('eyeOpenness', () => {
  it('inverts the blink value', () => {
    const { left, right } = eyeOpenness(0, 1);
    expect(left).toBe(1);
    expect(right).toBeCloseTo(0.06, 5);
  });

  it('never fully closes the eyelid', () => {
    // A 0-height eye ellipse makes the iris clip away and the eye pops.
    expect(eyeOpenness(1, 1).left).toBeGreaterThan(0);
  });
});

describe('eyeOffsets', () => {
  it('clamps gaze offset to a few pixels', () => {
    expect(eyeOffsets(100, 100)).toEqual({ x: 4, y: 3 });
    expect(eyeOffsets(-100, -100)).toEqual({ x: -4, y: -3 });
    expect(eyeOffsets(0, 0)).toEqual({ x: 0, y: 0 });
  });
});

describe('mouthOpening', () => {
  it('uses the tracked ratio when it dominates', () => {
    expect(mouthOpening(1, 0)).toBe(22);
  });

  it('lets the manual override win only when bigger', () => {
    expect(mouthOpening(0.1, 1)).toBe(18);
    expect(mouthOpening(1, 1)).toBe(22);
  });

  it('treats a missing pose as a closed mouth', () => {
    expect(mouthOpening(null, 0)).toBe(0);
  });
});

describe('smoothPose', () => {
  const pose: PoseData = {
    eyeLHTemp: 1,
    eyeRHTemp: 1,
    mouthRatio: 1,
    eyeYRatio: 1,
    eyeXRatio: 1,
    xAngle: 1,
    yAngle: 1,
    zAngle: 1,
    headX: 1,
    headY: 1,
    headZ: 1,
  };

  it('passes the target through on the first frame', () => {
    expect(smoothPose(pose, null)).toBe(pose);
  });

  it('returns null when tracking is lost', () => {
    expect(smoothPose(null, pose)).toBeNull();
  });

  it('lerps toward the target rather than snapping', () => {
    const prev: PoseData = { ...pose, mouthRatio: 0, xAngle: 0 };
    const next = smoothPose(pose, prev)!;
    expect(next.mouthRatio).toBeGreaterThan(0);
    expect(next.mouthRatio).toBeLessThan(1);
    expect(next.xAngle).toBeGreaterThan(0);
    expect(next.xAngle).toBeLessThan(next.mouthRatio);
  });
});
