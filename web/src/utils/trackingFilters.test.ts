import { describe, expect, it } from 'vitest';
import type { PoseData } from './poseExtractor';
import {
  DEFAULT_TRACKING_TUNING,
  applyTrackingPipeline,
  captureCalibration,
  computeAudioMouthEnvelope,
  sampleAutoBlink,
  smoothPoseWithFactor,
  type AutoBlinkState,
} from './trackingFilters';

const samplePose: PoseData = {
  eyeLHTemp: 0.1,
  eyeRHTemp: 0.1,
  mouthRatio: 0.2,
  eyeXRatio: 0.3,
  eyeYRatio: -0.2,
  xAngle: 0.4,
  yAngle: -0.3,
  zAngle: 0.15,
  headX: 0.25,
  headY: -0.1,
  headZ: 0.05,
};

describe('calibration and tracking pipeline', () => {
  it('zeros head angles and gaze after calibration', () => {
    const cal = captureCalibration(samplePose);
    const blinkState: AutoBlinkState = { nextBlinkAtMs: 99999, blinkStartMs: null };
    const tuned = applyTrackingPipeline(
      samplePose,
      cal,
      { ...DEFAULT_TRACKING_TUNING, autoBlink: false, idleBreathing: false },
      0,
      1000,
      blinkState,
    );
    expect(tuned).not.toBeNull();
    expect(tuned!.xAngle).toBeCloseTo(0, 5);
    expect(tuned!.yAngle).toBeCloseTo(0, 5);
    expect(tuned!.zAngle).toBeCloseTo(0, 5);
    expect(tuned!.eyeXRatio).toBeCloseTo(0, 5);
    expect(tuned!.eyeYRatio).toBeCloseTo(0, 5);
  });

  it('scales head movement by sensitivity and blends microphone lip-sync', () => {
    const blinkState: AutoBlinkState = { nextBlinkAtMs: 99999, blinkStartMs: null };
    const tuned = applyTrackingPipeline(
      samplePose,
      null,
      { headSensitivity: 1.5, smoothing: 0.5, autoBlink: false, idleBreathing: false },
      0.85,
      1000,
      blinkState,
    );
    expect(tuned!.yAngle).toBeCloseTo(samplePose.yAngle * 1.5, 5);
    expect(tuned!.mouthRatio).toBeCloseTo(0.85, 5);
  });

  it('synthesizes a live mic/idle pose when camera tracking is absent', () => {
    const blinkState: AutoBlinkState = { nextBlinkAtMs: 99999, blinkStartMs: null };
    const idle = applyTrackingPipeline(
      null,
      null,
      { headSensitivity: 1, smoothing: 0.5, autoBlink: true, idleBreathing: true },
      0.6,
      1000,
      blinkState,
    );
    expect(idle).not.toBeNull();
    expect(idle!.mouthRatio).toBeCloseTo(0.6, 5);
  });
});

describe('sampleAutoBlink', () => {
  it('closes and reopens smoothly across the blink window', () => {
    const state: AutoBlinkState = { nextBlinkAtMs: 1000, blinkStartMs: null };
    expect(sampleAutoBlink(500, state, () => 0.5)).toBe(0);
    expect(sampleAutoBlink(1000, state, () => 0.5)).toBe(0);
    expect(sampleAutoBlink(1040, state, () => 0.5)).toBeCloseTo(0.5, 2);
    expect(sampleAutoBlink(1080, state, () => 0.5)).toBeCloseTo(1, 2);
    expect(sampleAutoBlink(1250, state, () => 0.5)).toBe(0);
    expect(state.nextBlinkAtMs).toBeGreaterThan(1250);
  });
});

describe('smoothPoseWithFactor', () => {
  it('moves less per frame when smoothing is higher', () => {
    const prev: PoseData = { ...samplePose, xAngle: 0, mouthRatio: 0 };
    const snappy = smoothPoseWithFactor(samplePose, prev, 0.1)!;
    const smooth = smoothPoseWithFactor(samplePose, prev, 0.85)!;
    expect(snappy.xAngle).toBeGreaterThan(smooth.xAngle);
    expect(smooth.xAngle).toBeGreaterThan(0);
  });
});

describe('computeAudioMouthEnvelope', () => {
  it('gates quiet background noise and opens mouth on louder speech', () => {
    const quiet = new Float32Array(256).fill(0.01);
    const gated = computeAudioMouthEnvelope(quiet, 0, 2.5, 0.02);
    expect(gated.mouth).toBe(0);

    const loud = new Float32Array(256).fill(0.12);
    const active = computeAudioMouthEnvelope(loud, 0, 2.5, 0.02);
    expect(active.mouth).toBeGreaterThan(0.4);
    expect(active.mouth).toBeLessThanOrEqual(1);
  });
});
