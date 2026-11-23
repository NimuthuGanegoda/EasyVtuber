import type { PoseData } from './poseExtractor';
import type { TrackingTuning } from '../types';

export interface PoseCalibration {
  xAngle: number;
  yAngle: number;
  zAngle: number;
  headX: number;
  headY: number;
  eyeXRatio: number;
  eyeYRatio: number;
}

export interface AutoBlinkState {
  nextBlinkAtMs: number;
  blinkStartMs: number | null;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const DEFAULT_TRACKING_TUNING: TrackingTuning = {
  headSensitivity: 1.0,
  smoothing: 0.55,
  autoBlink: true,
  idleBreathing: true,
};

/** Capture the user's current neutral resting pose as the zero reference. */
export function captureCalibration(pose: PoseData): PoseCalibration {
  return {
    xAngle: pose.xAngle,
    yAngle: pose.yAngle,
    zAngle: pose.zAngle,
    headX: pose.headX,
    headY: pose.headY,
    eyeXRatio: pose.eyeXRatio,
    eyeYRatio: pose.eyeYRatio,
  };
}

/**
 * Compute an organic blink closure (0=open .. 1=closed) for idle / auto-blink.
 * Closes quickly (~80ms) and reopens gently (~110ms) every 2.8–5.8 seconds.
 */
export function sampleAutoBlink(
  nowMs: number,
  state: AutoBlinkState,
  rand: () => number = Math.random,
): number {
  const BLINK_CLOSE_MS = 80;
  const BLINK_OPEN_MS = 110;
  const TOTAL_MS = BLINK_CLOSE_MS + BLINK_OPEN_MS;

  if (state.nextBlinkAtMs === 0) {
    state.nextBlinkAtMs = nowMs + 2400 + rand() * 2400;
  }

  if (state.blinkStartMs === null && nowMs >= state.nextBlinkAtMs) {
    state.blinkStartMs = nowMs;
  }

  if (state.blinkStartMs !== null) {
    const elapsed = nowMs - state.blinkStartMs;
    if (elapsed >= TOTAL_MS) {
      state.blinkStartMs = null;
      state.nextBlinkAtMs = nowMs + 2800 + rand() * 3000;
      return 0;
    }
    if (elapsed < BLINK_CLOSE_MS) {
      return clamp(elapsed / BLINK_CLOSE_MS, 0, 1);
    }
    return clamp(1 - (elapsed - BLINK_CLOSE_MS) / BLINK_OPEN_MS, 0, 1);
  }

  return 0;
}

/**
 * Apply user calibration zero-offset, head sensitivity, idle breathing,
 * auto-blink, and microphone audio lip-sync to produce the effective pose.
 *
 * When no camera pose is present (e.g. camera paused or mic-only VTubing),
 * synthesizes an idle/voice-driven pose so auto-blink, breathing, and
 * microphone lip-sync still animate the avatar naturally.
 */
export function applyTrackingPipeline(
  rawPose: PoseData | null,
  calibration: PoseCalibration | null,
  tuning: TrackingTuning,
  audioMouth: number,
  nowMs: number,
  blinkState: AutoBlinkState,
): PoseData | null {
  const safeAudio = clamp(Number.isFinite(audioMouth) ? audioMouth : 0, 0, 1);
  const sens = clamp(tuning.headSensitivity, 0.25, 2.5);
  const breath = tuning.idleBreathing ? Math.sin(nowMs * 0.0022) : 0;
  const autoBlinkVal = tuning.autoBlink ? sampleAutoBlink(nowMs, blinkState) : 0;

  if (!rawPose) {
    if (!tuning.autoBlink && !tuning.idleBreathing && safeAudio <= 0.005) {
      return null;
    }
    return {
      eyeLHTemp: autoBlinkVal,
      eyeRHTemp: autoBlinkVal,
      mouthRatio: safeAudio,
      eyeXRatio: 0,
      eyeYRatio: 0,
      xAngle: breath * 0.045,
      yAngle: Math.sin(nowMs * 0.0009) * 0.03 * (tuning.idleBreathing ? 1 : 0),
      zAngle: breath * 0.025,
      headX: 0,
      headY: breath * 0.04,
      headZ: 0,
    };
  }

  const calX = calibration?.xAngle ?? 0;
  const calY = calibration?.yAngle ?? 0;
  const calZ = calibration?.zAngle ?? 0;
  const calHeadX = calibration?.headX ?? 0;
  const calHeadY = calibration?.headY ?? 0;
  const calEyeX = calibration?.eyeXRatio ?? 0;
  const calEyeY = calibration?.eyeYRatio ?? 0;

  return {
    eyeLHTemp: clamp(Math.max(rawPose.eyeLHTemp, autoBlinkVal), 0, 1),
    eyeRHTemp: clamp(Math.max(rawPose.eyeRHTemp, autoBlinkVal), 0, 1),
    mouthRatio: clamp(Math.max(rawPose.mouthRatio, safeAudio), 0, 1),
    eyeXRatio: rawPose.eyeXRatio - calEyeX,
    eyeYRatio: rawPose.eyeYRatio - calEyeY,
    xAngle: (rawPose.xAngle - calX) * sens + breath * 0.03,
    yAngle: (rawPose.yAngle - calY) * sens,
    zAngle: (rawPose.zAngle - calZ) * sens + breath * 0.015,
    headX: (rawPose.headX - calHeadX) * sens,
    headY: (rawPose.headY - calHeadY) * sens + breath * 0.025,
    headZ: rawPose.headZ,
  };
}

/**
 * Exponential smoothing parameterized by a 0..0.9 user smoothing factor
 * (0 = instant/raw, 0.55 = balanced studio default, 0.9 = very smooth).
 */
export function smoothPoseWithFactor(
  target: PoseData | null,
  prev: PoseData | null,
  smoothing: number,
): PoseData | null {
  if (!target) return null;
  if (!prev) return target;
  const s = clamp(smoothing, 0, 0.92);
  // Higher smoothing = smaller lerp alpha; blinks remain snappier than head angles.
  const headAlpha = clamp(1 - s * 0.88, 0.08, 1);
  const mouthAlpha = clamp(1 - s * 0.65, 0.18, 1);
  const eyeAlpha = clamp(1 - s * 0.5, 0.28, 1);
  const gazeAlpha = clamp(1 - s * 0.72, 0.15, 1);

  return {
    eyeLHTemp: lerp(prev.eyeLHTemp, target.eyeLHTemp, eyeAlpha),
    eyeRHTemp: lerp(prev.eyeRHTemp, target.eyeRHTemp, eyeAlpha),
    mouthRatio: lerp(prev.mouthRatio, target.mouthRatio, mouthAlpha),
    eyeXRatio: lerp(prev.eyeXRatio, target.eyeXRatio, gazeAlpha),
    eyeYRatio: lerp(prev.eyeYRatio, target.eyeYRatio, gazeAlpha),
    xAngle: lerp(prev.xAngle, target.xAngle, headAlpha),
    yAngle: lerp(prev.yAngle, target.yAngle, headAlpha),
    zAngle: lerp(prev.zAngle, target.zAngle, headAlpha),
    headX: lerp(prev.headX, target.headX, headAlpha),
    headY: lerp(prev.headY, target.headY, headAlpha),
    headZ: lerp(prev.headZ, target.headZ, headAlpha),
  };
}

/**
 * Compute voice-driven mouth openness (0..1) from a time-domain PCM frame
 * with noise gate + fast attack / smooth release envelope.
 */
export function computeAudioMouthEnvelope(
  samples: ArrayLike<number>,
  prevMouth: number,
  sensitivity: number,
  noiseGate: number,
): { rms: number; mouth: number } {
  const len = samples.length;
  if (len === 0) {
    return { rms: 0, mouth: prevMouth * 0.72 };
  }
  let sumSq = 0;
  for (let i = 0; i < len; i++) {
    const v = samples[i] ?? 0;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / len);
  const gate = clamp(noiseGate, 0, 0.5);
  const gain = clamp(sensitivity, 0.5, 15);
  const gated = Math.max(0, rms - gate);
  const target = clamp(gated * gain * 6.5, 0, 1);
  // Fast attack so syllables pop cleanly; slightly slower release to prevent chatter.
  const alpha = target > prevMouth ? 0.65 : 0.28;
  return {
    rms,
    mouth: clamp(lerp(prevMouth, target, alpha), 0, 1),
  };
}
