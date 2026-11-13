/**
 * Canvas 2D character renderer — the fallback used when no VRM model is
 * present and WebGL is unavailable (see App.tsx's render fallback chain).
 *
 * Kept separate from App.tsx so the component file stays about UI and the
 * drawing code stays reviewable/testable on its own terms.
 */

import type { ExpressionState, OverlayItem } from '../hooks/useVtuber';
import type { PoseData } from '../utils/poseExtractor';
import {
  CANVAS_SIZE,
  CHAR_CENTER_X,
  CHAR_CENTER_Y,
  COL_HAIR,
  COL_HAIR_DARK,
  COL_HAIR_LIGHT,
  COL_IRIS,
  COL_IRIS_DARK,
  COL_MOUTH,
  COL_MOUTH_INNER,
  COL_OUTLINE,
  COL_PUPIL,
  COL_SKIN,
  COL_SKIN_SHADE,
  EYE_H,
  EYE_SPACING,
  EYE_W,
  HEAD_R,
  HEAD_ROLL_GAIN,
  HEAD_TILT_GAIN,
  HEAD_TURN_GAIN,
  IRIS_R,
  MOUTH_MAX_W,
  MOUTH_Y,
  PUPIL_R,
  blushRadius,
  eyeOffsets,
  eyeOpenness,
  mouthOpening,
} from './spec';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Per-frame pose values come straight from tracking with no temporal
 * smoothing, so tiny per-frame tracking noise reads as mechanical jitter.
 * Lerp toward the target each frame instead of snapping to it — different
 * rates per field, since blinks should stay snappy while head rotation
 * (the most jitter-visible signal) benefits from heavier smoothing.
 */
export function smoothPose(target: PoseData | null, prev: PoseData | null): PoseData | null {
  if (!target) return null;
  if (!prev) return target;
  return {
    eyeLHTemp: lerp(prev.eyeLHTemp, target.eyeLHTemp, 0.6),
    eyeRHTemp: lerp(prev.eyeRHTemp, target.eyeRHTemp, 0.6),
    mouthRatio: lerp(prev.mouthRatio, target.mouthRatio, 0.4),
    eyeYRatio: lerp(prev.eyeYRatio, target.eyeYRatio, 0.3),
    eyeXRatio: lerp(prev.eyeXRatio, target.eyeXRatio, 0.3),
    xAngle: lerp(prev.xAngle, target.xAngle, 0.2),
    yAngle: lerp(prev.yAngle, target.yAngle, 0.2),
    zAngle: lerp(prev.zAngle, target.zAngle, 0.2),
    headX: lerp(prev.headX, target.headX, 0.25),
    headY: lerp(prev.headY, target.headY, 0.25),
    headZ: lerp(prev.headZ, target.headZ, 0.25),
  };
}

function faceOutline(ctx: CanvasRenderingContext2D, r: number) {
  // Anime-style face: wider through the temples/cheeks, tapering to a
  // rounded chin, instead of a plain circle.
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.02);
  ctx.bezierCurveTo(r * 0.92, -r, r * 1.02, -r * 0.15, r * 0.78, r * 0.48);
  ctx.bezierCurveTo(r * 0.6, r * 0.92, r * 0.28, r * 1.12, 0, r * 1.12);
  ctx.bezierCurveTo(-r * 0.28, r * 1.12, -r * 0.6, r * 0.92, -r * 0.78, r * 0.48);
  ctx.bezierCurveTo(-r * 1.02, -r * 0.15, -r * 0.92, -r, 0, -r * 1.02);
  ctx.closePath();
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  pose: PoseData | null,
  expression: ExpressionState,
) {
  ctx.save();

  const headTilt = pose ? (pose.xAngle || 0) * HEAD_TILT_GAIN : 0;
  const headTurn = pose ? (pose.yAngle || 0) * HEAD_TURN_GAIN : 0;
  const headRoll = pose ? (pose.zAngle || 0) * HEAD_ROLL_GAIN : 0;

  ctx.translate(CHAR_CENTER_X + headTurn, CHAR_CENTER_Y + headTilt);
  ctx.rotate((headRoll * Math.PI) / 180);

  // ---- Body ----
  ctx.beginPath();
  ctx.ellipse(0, HEAD_R * 2.4, HEAD_R * 1.25, HEAD_R * 1.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 150, 190, 0.4)';
  ctx.fill();

  // ---- Long hair tails (flow down past the shoulders, drawn before the
  // back-hair mass so they read as strands rather than a uniform halo) ----
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * HEAD_R * 0.55, -HEAD_R * 0.1);
    ctx.quadraticCurveTo(side * HEAD_R * 1.35, HEAD_R * 1.0, side * HEAD_R * 0.9, HEAD_R * 2.3);
    ctx.quadraticCurveTo(side * HEAD_R * 0.75, HEAD_R * 2.4, side * HEAD_R * 0.55, HEAD_R * 2.15);
    ctx.quadraticCurveTo(side * HEAD_R * 0.85, HEAD_R * 1.0, side * HEAD_R * 0.35, -HEAD_R * 0.05);
    ctx.closePath();
    ctx.fillStyle = COL_HAIR_DARK;
    ctx.fill();
  }

  // ---- Back hair mass (behind head) — hugs the face closely instead of
  // forming a big halo, so the face reads as the dominant shape, not a
  // small window inside a hair blob ----
  ctx.beginPath();
  ctx.ellipse(0, HEAD_R * 0.1, HEAD_R * 0.82, HEAD_R * 1.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = COL_HAIR_DARK;
  ctx.fill();

  // Subtle hair strand shading (a few darker streaks for depth, instead of
  // one flat fill) — kept faint, just enough to break up the flatness.
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, HEAD_R * 0.1, HEAD_R * 0.82, HEAD_R * 1.12, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const sx of [-0.5, -0.15, 0.2, 0.5]) {
    ctx.beginPath();
    ctx.moveTo(HEAD_R * sx, -HEAD_R * 0.9);
    ctx.quadraticCurveTo(HEAD_R * sx * 1.3, HEAD_R * 0.1, HEAD_R * sx * 1.1, HEAD_R * 0.9);
    ctx.stroke();
  }
  ctx.restore();

  // ---- Neck ----
  ctx.beginPath();
  ctx.rect(-13, HEAD_R * 0.75, 26, HEAD_R * 0.55);
  ctx.fillStyle = COL_SKIN_SHADE;
  ctx.fill();

  // ---- Face ----
  faceOutline(ctx, HEAD_R);
  ctx.fillStyle = COL_SKIN;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = COL_OUTLINE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Soft cheek shading
  ctx.save();
  faceOutline(ctx, HEAD_R);
  ctx.clip();
  const cheekGrad = ctx.createRadialGradient(
    0,
    HEAD_R * 0.55,
    HEAD_R * 0.1,
    0,
    HEAD_R * 0.55,
    HEAD_R * 0.85,
  );
  cheekGrad.addColorStop(0, 'rgba(255, 170, 150, 0)');
  cheekGrad.addColorStop(1, 'rgba(255, 150, 130, 0.22)');
  ctx.fillStyle = cheekGrad;
  ctx.fillRect(-HEAD_R * 1.2, -HEAD_R * 1.2, HEAD_R * 2.4, HEAD_R * 2.4);
  ctx.restore();

  // ---- Blush ---- (manual "cheek puff" override enlarges + darkens it)
  const puffR = blushRadius(expression.cheekPuff);
  for (const side of [-1, 1]) {
    const bx = side * HEAD_R * 0.55;
    const by = HEAD_R * 0.35;
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, puffR);
    gradient.addColorStop(0, `rgba(255, 110, 150, ${0.45 + expression.cheekPuff * 0.25})`);
    gradient.addColorStop(1, 'rgba(255, 110, 150, 0)');
    ctx.beginPath();
    ctx.arc(bx, by, puffR, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // ---- Eyes ----
  const openness = eyeOpenness(pose?.eyeLHTemp ?? 0, pose?.eyeRHTemp ?? 0);
  const eyeOffset = eyeOffsets(pose?.eyeXRatio ?? 0, pose?.eyeYRatio ?? 0);

  for (const side of [-1, 1]) {
    const ex = side * EYE_SPACING;
    const ey = -HEAD_R * 0.12;

    // Manual "eye smile" override (from the Expressions panel): classic
    // anime closed-happy-eye curve, replacing the tracked eye entirely.
    if (expression.eyeSmile > 0.5) {
      ctx.beginPath();
      ctx.arc(ex, ey + EYE_H * 0.3, EYE_W * 0.9, Math.PI * 1.15, Math.PI * 1.85, true);
      ctx.strokeStyle = COL_OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      continue;
    }

    const openAmt = side === -1 ? openness.left : openness.right;
    const eh = EYE_H * openAmt;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, EYE_W, eh, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#fff8fb';
    ctx.fillRect(ex - EYE_W, ey - eh, EYE_W * 2, eh * 2);

    // Iris sits slightly low in the eye (a sliver of white above it, like a
    // real eye socket) rather than perfectly centered — centered pupils
    // with even white all around is a big part of what reads as a "dead"
    // doll stare.
    const irisY = ey + eh * 0.15 + eyeOffset.y;
    const irisX = ex + eyeOffset.x;

    if (openAmt > 0.15) {
      const irisR = Math.min(IRIS_R, EYE_W * 0.66);
      const irisGrad = ctx.createRadialGradient(
        irisX - 2,
        irisY - irisR * 0.5,
        1,
        irisX,
        irisY,
        irisR,
      );
      irisGrad.addColorStop(0, COL_IRIS);
      irisGrad.addColorStop(0.7, COL_IRIS);
      irisGrad.addColorStop(1, COL_IRIS_DARK);
      ctx.beginPath();
      ctx.arc(irisX, irisY, irisR, 0, Math.PI * 2);
      ctx.fillStyle = irisGrad;
      ctx.fill();

      // Pupil with a faint gradient instead of a flat dot
      const pupilGrad = ctx.createRadialGradient(irisX, irisY, 0, irisX, irisY, PUPIL_R);
      pupilGrad.addColorStop(0, '#3a1c40');
      pupilGrad.addColorStop(1, COL_PUPIL);
      ctx.beginPath();
      ctx.arc(irisX, irisY, PUPIL_R, 0, Math.PI * 2);
      ctx.fillStyle = pupilGrad;
      ctx.fill();

      // Primary highlight (upper-left, biggest) + secondary sparkle +
      // a faint lower rim-light for a bit of catch-light life
      ctx.beginPath();
      ctx.arc(irisX - 3.5, irisY - 4.5, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(irisX + 3, irisY + 3, 1.1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(irisX, irisY + irisR * 0.7, irisR * 0.45, Math.PI, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
    }

    // Soft under-eye/socket shadow at the top, inside the clip — gives the
    // eye a socket instead of floating on flat skin
    const socketShade = ctx.createLinearGradient(ex, ey - eh, ex, ey - eh * 0.3);
    socketShade.addColorStop(0, 'rgba(120,60,80,0.22)');
    socketShade.addColorStop(1, 'rgba(120,60,80,0)');
    ctx.fillStyle = socketShade;
    ctx.fillRect(ex - EYE_W, ey - eh, EYE_W * 2, eh);
    ctx.restore();

    // Eyelid crease (a second, higher arc above the lash line) — this is
    // what mainly separates "flat circle with a line" from an eye that
    // reads as sitting in a face.
    ctx.beginPath();
    ctx.ellipse(ex, ey - eh * 0.55, EYE_W * 0.85, eh * 0.4, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.strokeStyle = 'rgba(92,44,71,0.22)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Upper lash line (bold) and lower lid (subtle)
    ctx.beginPath();
    ctx.ellipse(ex, ey, EYE_W, eh, 0, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = COL_OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(ex, ey, EYE_W, eh, 0, Math.PI * 0.08, Math.PI * 0.92);
    ctx.strokeStyle = 'rgba(92,44,71,0.35)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  // ---- Eyebrows ---- (manual "raise" override shifts them up)
  const browLift = expression.eyebrowRaise * HEAD_R * 0.12;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (EYE_SPACING - 14), -HEAD_R * 0.42 - browLift);
    ctx.quadraticCurveTo(
      side * EYE_SPACING,
      -HEAD_R * 0.5 - browLift,
      side * (EYE_SPACING + 13),
      -HEAD_R * 0.4 - browLift,
    );
    ctx.strokeStyle = COL_HAIR_DARK;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // ---- Nose: a bridge shadow + tip highlight instead of a single faint
  // line — the previous version was nearly invisible and left the face
  // reading as flat with features pasted on rather than actual structure ----
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-1.5, HEAD_R * 0.02);
  ctx.quadraticCurveTo(1, HEAD_R * 0.15, 2.5, HEAD_R * 0.25);
  ctx.strokeStyle = 'rgba(120,70,60,0.28)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Tip highlight + nostril shadow give it a slight 3D bump instead of a
  // flat line
  ctx.beginPath();
  ctx.ellipse(1.5, HEAD_R * 0.26, 2.6, 1.6, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,235,225,0.5)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3, HEAD_R * 0.29, 1.6, 1, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(160,90,80,0.22)';
  ctx.fill();
  ctx.restore();

  // ---- Jaw/chin shading — a soft shadow along the lower face gives it
  // actual structure instead of reading as a flat skin-colored oval ----
  ctx.save();
  faceOutline(ctx, HEAD_R);
  ctx.clip();
  const jawGrad = ctx.createLinearGradient(0, HEAD_R * 0.55, 0, HEAD_R * 1.15);
  jawGrad.addColorStop(0, 'rgba(180,110,95,0)');
  jawGrad.addColorStop(1, 'rgba(180,110,95,0.28)');
  ctx.fillStyle = jawGrad;
  ctx.fillRect(-HEAD_R * 1.2, HEAD_R * 0.4, HEAD_R * 2.4, HEAD_R * 0.9);
  // Forehead highlight — a touch of light from above so the face isn't
  // uniformly flat-lit
  const foreheadGrad = ctx.createRadialGradient(
    0,
    -HEAD_R * 0.55,
    0,
    0,
    -HEAD_R * 0.55,
    HEAD_R * 0.6,
  );
  foreheadGrad.addColorStop(0, 'rgba(255,255,250,0.25)');
  foreheadGrad.addColorStop(1, 'rgba(255,255,250,0)');
  ctx.fillStyle = foreheadGrad;
  ctx.fillRect(-HEAD_R * 1.2, -HEAD_R * 1.2, HEAD_R * 2.4, HEAD_R * 1.2);
  ctx.restore();

  // ---- Mouth ---- (manual "mouth open" override forces it wide, whichever is bigger wins)
  const mouthOpen = mouthOpening(pose ? pose.mouthRatio : null, expression.mouthOpen);
  if (mouthOpen < 2) {
    ctx.beginPath();
    ctx.moveTo(-MOUTH_MAX_W * 0.55, MOUTH_Y);
    ctx.quadraticCurveTo(0, MOUTH_Y + 5, MOUTH_MAX_W * 0.55, MOUTH_Y);
    ctx.strokeStyle = COL_MOUTH;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();
  } else {
    const my = MOUTH_Y + mouthOpen * 0.3;
    ctx.beginPath();
    ctx.ellipse(0, my, MOUTH_MAX_W * 0.62, mouthOpen * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = COL_MOUTH_INNER;
    ctx.fill();
    ctx.strokeStyle = COL_MOUTH;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // ---- Front hair: bangs ----
  ctx.beginPath();
  ctx.moveTo(-HEAD_R * 0.95, -HEAD_R * 0.15);
  ctx.quadraticCurveTo(-HEAD_R * 0.6, -HEAD_R * 1.05, 0, -HEAD_R * 0.98);
  ctx.quadraticCurveTo(HEAD_R * 0.6, -HEAD_R * 1.05, HEAD_R * 0.95, -HEAD_R * 0.15);
  ctx.quadraticCurveTo(HEAD_R * 0.55, -HEAD_R * 0.55, 0, -HEAD_R * 0.5);
  ctx.quadraticCurveTo(-HEAD_R * 0.55, -HEAD_R * 0.55, -HEAD_R * 0.95, -HEAD_R * 0.15);
  ctx.closePath();
  const hairGrad = ctx.createLinearGradient(0, -HEAD_R, 0, -HEAD_R * 0.3);
  hairGrad.addColorStop(0, COL_HAIR_LIGHT);
  hairGrad.addColorStop(1, COL_HAIR);
  ctx.fillStyle = hairGrad;
  ctx.fill();

  // ---- Side locks (brighter than the back hair mass so they read as
  // distinct strands framing the face rather than blending into it) ----
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * HEAD_R * 0.82, -HEAD_R * 0.32);
    ctx.quadraticCurveTo(side * HEAD_R * 1.1, HEAD_R * 0.3, side * HEAD_R * 0.8, HEAD_R * 0.95);
    ctx.quadraticCurveTo(side * HEAD_R * 0.62, HEAD_R * 0.5, side * HEAD_R * 0.6, -HEAD_R * 0.22);
    ctx.closePath();
    const lockGrad = ctx.createLinearGradient(
      side * HEAD_R * 0.6,
      -HEAD_R * 0.3,
      side * HEAD_R * 1.1,
      HEAD_R * 0.9,
    );
    lockGrad.addColorStop(0, COL_HAIR_LIGHT);
    lockGrad.addColorStop(1, COL_HAIR);
    ctx.fillStyle = lockGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(92,44,71,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();
}

export function drawOverlays(ctx: CanvasRenderingContext2D, overlays: OverlayItem[]) {
  for (const item of overlays) {
    if (item.type !== 'emoji') continue;
    ctx.save();
    ctx.font = `${32 * item.scale}px serif`;
    ctx.globalAlpha = item.opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(item.x * CANVAS_SIZE, item.y * CANVAS_SIZE);
    ctx.rotate((item.rotation * Math.PI) / 180);
    ctx.fillText(item.content, 0, 0);
    ctx.restore();
  }
}

/** Small tracking readout drawn into the canvas, plus the "paused" watermark. */
export function drawHUD(
  ctx: CanvasRenderingContext2D,
  pose: PoseData | null,
  tracking: boolean,
  size = CANVAS_SIZE,
) {
  // The readout needs a pose, but the paused watermark must appear even when
  // tracking has not produced one yet.
  if (pose) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(
      `Eyes: L${(pose.eyeLHTemp * 100).toFixed(0)}% R${(pose.eyeRHTemp * 100).toFixed(0)}%`,
      12,
      12,
    );
    ctx.fillText(`Mouth: ${(pose.mouthRatio * 100).toFixed(0)}%`, 12, 28);
    ctx.fillText(`Head: ${(pose.headX * 10).toFixed(1)}°/${(pose.headY * 10).toFixed(1)}°`, 12, 44);
  }

  if (!tracking) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSED', size / 2, size / 2);
    ctx.restore();
  }
}
