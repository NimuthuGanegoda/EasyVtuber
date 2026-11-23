import type { ExpressionState, PngAvatarConfig } from '../types';
import type { PoseData } from '../utils/poseExtractor';
import { CANVAS_SIZE } from './spec';

export interface PngAvatarSprites {
  idle: HTMLImageElement | null;
  talking: HTMLImageElement | null;
  blinking: HTMLImageElement | null;
}

export const DEFAULT_PNG_AVATAR_CONFIG: PngAvatarConfig = {
  name: '',
  bounceStrength: 0.7,
  talkThreshold: 0.14,
  parallaxStrength: 0.75,
};

export interface PngRenderState {
  bounce: number;
  talkPhase: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Render a reactive 2D PNG / PNGTuber avatar onto a 512×512 logical canvas.
 *
 * Supports both single-image 2.5D motion (head tilt/turn/roll parallax, idle
 * breathing, elastic voice-reactive bounce) and multi-state PNGTuber sprites
 * (Idle / Talking / Blinking) just like Veadotube Mini & Fugitech Reactive.
 */
export function drawPngAvatar(
  ctx: CanvasRenderingContext2D,
  sprites: PngAvatarSprites,
  pose: PoseData | null,
  expression: ExpressionState,
  audioMouth: number,
  config: PngAvatarConfig,
  renderState: PngRenderState,
  nowMs: number,
): boolean {
  const idle = sprites.idle;
  if (!idle || !idle.complete || idle.naturalWidth === 0) {
    return false;
  }

  const effectiveMouth = Math.max(pose?.mouthRatio ?? 0, audioMouth, expression.mouthOpen);
  const isTalking = effectiveMouth >= clamp(config.talkThreshold, 0.02, 0.8);
  const blinkLevel = Math.max(pose?.eyeLHTemp ?? 0, pose?.eyeRHTemp ?? 0);
  const isBlinking = blinkLevel > 0.65 || expression.eyeSmile > 0.5;

  let activeImg: HTMLImageElement = idle;
  if (
    isBlinking &&
    sprites.blinking &&
    sprites.blinking.complete &&
    sprites.blinking.naturalWidth > 0 &&
    !isTalking
  ) {
    activeImg = sprites.blinking;
  } else if (
    isTalking &&
    sprites.talking &&
    sprites.talking.complete &&
    sprites.talking.naturalWidth > 0
  ) {
    activeImg = sprites.talking;
  }

  // Elastic voice-reactive bounce envelope
  if (isTalking) {
    renderState.talkPhase += 0.34;
    const pulse =
      (0.5 + 0.5 * Math.sin(renderState.talkPhase)) * clamp(effectiveMouth * 1.4, 0.3, 1);
    renderState.bounce = lerp(renderState.bounce, pulse, 0.42);
  } else {
    renderState.bounce = lerp(renderState.bounce, 0, 0.22);
  }

  const parallax = clamp(config.parallaxStrength, 0, 1.5);
  const bounceGain = clamp(config.bounceStrength, 0, 1.5);

  const yaw = clamp(pose?.yAngle ?? 0, -0.7, 0.7);
  const pitch = clamp(pose?.xAngle ?? 0, -0.6, 0.6);
  const roll = clamp(pose?.zAngle ?? 0, -0.5, 0.5);

  const offsetX = yaw * 26 * parallax;
  const offsetY = pitch * 20 * parallax - renderState.bounce * 18 * bounceGain;
  const rotation = roll * 0.28 * parallax;

  const breath = Math.sin(nowMs * 0.0021) * 0.012;
  const squashX = 1 - renderState.bounce * 0.035 * bounceGain;
  const stretchY = 1 + renderState.bounce * 0.045 * bounceGain + breath;
  // Subtle horizontal perspective foreshortening when turning the head
  const turnScaleX = 1 - Math.abs(yaw) * 0.08 * parallax;

  // Fit inside logical CANVAS_SIZE with comfortable breathing room at top/bottom
  const maxW = CANVAS_SIZE * 0.88;
  const maxH = CANVAS_SIZE * 0.9;
  const aspect = activeImg.naturalWidth / Math.max(activeImg.naturalHeight, 1);
  let drawW = maxW;
  let drawH = drawW / aspect;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = drawH * aspect;
  }

  // Pivot around lower-center so head tilt/bounce feels anchored to shoulders
  const pivotX = CANVAS_SIZE / 2 + offsetX;
  const pivotY = CANVAS_SIZE * 0.92 + offsetY;

  ctx.save();
  ctx.translate(pivotX, pivotY);
  ctx.rotate(rotation);
  ctx.scale(squashX * turnScaleX, stretchY);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(activeImg, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
  return true;
}
