import { describe, expect, it } from 'vitest';
import {
  POSE_MIN_LANDMARKS,
  PoseExtractionError,
  extractHeadRotationFromMatrix,
  extractPose,
  hasIrisLandmarks,
  type Landmark,
} from './poseExtractor';

const MESH_POINTS = 468;
const WITH_IRIS = 478;

/**
 * Build a plausible normalized-coordinate face mesh: a loose grid with small
 * per-index offsets, so no two landmarks coincide (which would make ratios
 * divide by zero and hide real regressions).
 */
function makeLandmarks(count: number, overrides: Record<number, Partial<Landmark>> = {}) {
  const landmarks: Landmark[] = [];
  for (let i = 0; i < count; i += 1) {
    const col = i % 20;
    const row = Math.floor(i / 20) % 20;
    landmarks.push({
      x: 0.25 + col * 0.025,
      y: 0.2 + row * 0.03,
      z: -0.01 + (i % 7) * 0.002,
    });
  }
  for (const [index, patch] of Object.entries(overrides)) {
    const idx = Number(index);
    landmarks[idx] = { ...landmarks[idx]!, ...patch };
  }
  return landmarks;
}

/** Column-major 4x4 from a row-major 3x3 (what MediaPipe returns). */
function columnMajorFrom3x3(rows: number[][]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1];
  for (let col = 0; col < 3; col += 1) {
    for (let row = 0; row < 3; row += 1) {
      out[col * 4 + row] = rows[row]![col]!;
    }
  }
  return out;
}

const CLOSED_MOUTH = {
  13: { y: 0.6 },
  14: { y: 0.62 },
  78: { x: 0.55 },
  409: { x: 0.45 },
  375: { x: 0.45 },
};

describe('extractPose', () => {
  it('reports the landmark population correctly', () => {
    expect(hasIrisLandmarks(makeLandmarks(WITH_IRIS))).toBe(true);
    expect(hasIrisLandmarks(makeLandmarks(MESH_POINTS))).toBe(false);
  });

  it('throws a descriptive error when there are too few landmarks', () => {
    expect(() => extractPose([])).toThrow(PoseExtractionError);
    expect(() => extractPose(makeLandmarks(100))).toThrow(/at least 468/);
  });

  it('still produces a pose with 468 points (no iris refinement)', () => {
    // Regression: this used to throw from the iris lookup, and both call sites
    // swallowed the throw, so the avatar silently froze.
    const pose = extractPose(makeLandmarks(MESH_POINTS, CLOSED_MOUTH));
    expect(Number.isFinite(pose.mouthRatio)).toBe(true);
    expect(Number.isFinite(pose.eyeXRatio)).toBe(true);
    expect(pose.eyeLHTemp).toBeGreaterThanOrEqual(0);
    expect(pose.eyeLHTemp).toBeLessThanOrEqual(1);
  });

  it('produces only finite, in-range values for a 478-point mesh', () => {
    const pose = extractPose(makeLandmarks(WITH_IRIS, CLOSED_MOUTH));
    for (const value of Object.values(pose)) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(pose.mouthRatio).toBeGreaterThanOrEqual(0);
    expect(pose.mouthRatio).toBeLessThanOrEqual(1);
  });

  it('does not emit NaN when every landmark collapses to one point', () => {
    // A degenerate frame (tracking loss) must not poison the renderer with NaN.
    const collapsed: Landmark[] = Array.from({ length: WITH_IRIS }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
    }));
    const pose = extractPose(collapsed);
    for (const value of Object.values(pose)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('prefers ML blendshapes over geometric estimates', () => {
    const pose = extractPose(makeLandmarks(WITH_IRIS, CLOSED_MOUTH), {
      jawOpen: 0.8,
      eyeBlinkLeft: 0.25,
      eyeBlinkRight: 0.9,
    });
    expect(pose.mouthRatio).toBeCloseTo(0.8, 5);
    // eyeLHTemp is the subject's right eye, matching ARKit naming.
    expect(pose.eyeLHTemp).toBeCloseTo(0.9, 5);
    expect(pose.eyeRHTemp).toBeCloseTo(0.25, 5);
  });

  it('falls back to geometry when blendshapes are absent', () => {
    const pose = extractPose(makeLandmarks(WITH_IRIS, CLOSED_MOUTH));
    expect(pose.mouthRatio).toBeGreaterThan(0);
  });

  it('uses the transform matrix for head rotation when provided', () => {
    const yaw = 0.4;
    const matrix = columnMajorFrom3x3([
      [Math.cos(yaw), 0, Math.sin(yaw)],
      [0, 1, 0],
      [-Math.sin(yaw), 0, Math.cos(yaw)],
    ]);
    const pose = extractPose(makeLandmarks(WITH_IRIS), undefined, matrix);
    expect(pose.yAngle).toBeCloseTo(yaw, 5);
    expect(pose.xAngle).toBeCloseTo(0, 5);
  });
});

describe('extractHeadRotationFromMatrix', () => {
  const cases: { axis: 'pitch' | 'yaw' | 'roll'; angle: number; matrix: number[] }[] = [];

  {
    const a = 0.3;
    cases.push({
      axis: 'yaw',
      angle: a,
      matrix: columnMajorFrom3x3([
        [Math.cos(a), 0, Math.sin(a)],
        [0, 1, 0],
        [-Math.sin(a), 0, Math.cos(a)],
      ]),
    });
    cases.push({
      axis: 'pitch',
      angle: a,
      matrix: columnMajorFrom3x3([
        [1, 0, 0],
        [0, Math.cos(a), -Math.sin(a)],
        [0, Math.sin(a), Math.cos(a)],
      ]),
    });
    cases.push({
      axis: 'roll',
      angle: a,
      matrix: columnMajorFrom3x3([
        [Math.cos(a), -Math.sin(a), 0],
        [Math.sin(a), Math.cos(a), 0],
        [0, 0, 1],
      ]),
    });
  }

  it.each(cases)('isolates $axis rotation with no cross-talk', ({ axis, angle, matrix }) => {
    const { pitch, yaw, roll } = extractHeadRotationFromMatrix(matrix);
    const actual = axis === 'pitch' ? pitch : axis === 'yaw' ? yaw : roll;
    expect(actual).toBeCloseTo(angle, 5);
    const others = [pitch, yaw, roll].filter((v) => !Object.is(v, actual));
    for (const other of others) {
      expect(Math.abs(other)).toBeLessThan(1e-6);
    }
  });

  it('handles gimbal lock without producing NaN', () => {
    const { pitch, yaw, roll } = extractHeadRotationFromMatrix(
      columnMajorFrom3x3([
        [0, 0, 1],
        [0, 1, 0],
        [-1, 0, 0],
      ]),
    );
    expect(Number.isFinite(pitch)).toBe(true);
    expect(roll).toBe(0);
    expect(Math.abs(yaw)).toBeCloseTo(Math.PI / 2, 5);
  });

  it('tolerates a truncated matrix instead of throwing', () => {
    const { pitch, yaw, roll } = extractHeadRotationFromMatrix([1, 0, 0]);
    expect([pitch, yaw, roll].every(Number.isFinite)).toBe(true);
  });
});

describe('POSE_MIN_LANDMARKS', () => {
  it('matches the documented 468-point mesh', () => {
    expect(POSE_MIN_LANDMARKS).toBe(MESH_POINTS);
  });
});
