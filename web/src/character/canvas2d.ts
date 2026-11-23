/**
 * Canvas 2D character renderer — HD studio anime avatar with customizable
 * palette, hair physics sway, anime collar/ribbon outfit, accessories
 * (fox ears, cat ears, halo, glasses, horns), and full 7-emotion support.
 */

import type { AvatarAppearance, ExpressionState, OverlayItem } from '../types';
import type { PoseData } from '../utils/poseExtractor';
import { DEFAULT_AVATAR_APPEARANCE } from './avatarAppearance';
import {
  CANVAS_SIZE,
  CHAR_CENTER_X,
  CHAR_CENTER_Y,
  COL_MOUTH,
  COL_MOUTH_INNER,
  COL_OUTLINE,
  COL_PUPIL,
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
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.02);
  ctx.bezierCurveTo(r * 0.92, -r, r * 1.02, -r * 0.15, r * 0.78, r * 0.48);
  ctx.bezierCurveTo(r * 0.6, r * 0.92, r * 0.28, r * 1.12, 0, r * 1.12);
  ctx.bezierCurveTo(-r * 0.28, r * 1.12, -r * 0.6, r * 0.92, -r * 0.78, r * 0.48);
  ctx.bezierCurveTo(-r * 1.02, -r * 0.15, -r * 0.92, -r, 0, -r * 1.02);
  ctx.closePath();
}

function drawBackAccessory(
  ctx: CanvasRenderingContext2D,
  appearance: AvatarAppearance,
  sway: number,
) {
  if (appearance.accessory === 'halo') {
    ctx.save();
    ctx.translate(sway * 5, -HEAD_R * 1.48);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.95)';
    ctx.shadowColor = 'rgba(253, 224, 71, 0.75)';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, HEAD_R * 0.62, HEAD_R * 0.15, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawTopAccessory(
  ctx: CanvasRenderingContext2D,
  appearance: AvatarAppearance,
  sway: number,
) {
  if (appearance.accessory === 'fox-ears') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * HEAD_R * 0.56, -HEAD_R * 0.82);
      ctx.rotate(side * 0.22 + sway * 0.08);
      // Outer fox ear
      ctx.beginPath();
      ctx.moveTo(-side * 18, 12);
      ctx.quadraticCurveTo(side * 4, -52, side * 34, -44);
      ctx.quadraticCurveTo(side * 28, -4, side * 14, 24);
      ctx.closePath();
      ctx.fillStyle = appearance.hairColor;
      ctx.fill();
      ctx.strokeStyle = appearance.hairDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      // White/cream inner ear fluff
      ctx.beginPath();
      ctx.moveTo(-side * 8, 8);
      ctx.quadraticCurveTo(side * 6, -34, side * 24, -30);
      ctx.quadraticCurveTo(side * 18, -4, side * 8, 14);
      ctx.closePath();
      ctx.fillStyle = '#fff5f7';
      ctx.fill();
      ctx.restore();
    }
  } else if (appearance.accessory === 'cat-ears') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * HEAD_R * 0.54, -HEAD_R * 0.84);
      ctx.rotate(side * 0.14 + sway * 0.06);
      ctx.beginPath();
      ctx.moveTo(-side * 16, 10);
      ctx.quadraticCurveTo(side * 2, -38, side * 22, -26);
      ctx.quadraticCurveTo(side * 20, 2, side * 12, 18);
      ctx.closePath();
      ctx.fillStyle = appearance.hairColor;
      ctx.fill();
      ctx.strokeStyle = appearance.hairDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-side * 7, 7);
      ctx.quadraticCurveTo(side * 3, -22, side * 14, -16);
      ctx.quadraticCurveTo(side * 13, 0, side * 7, 10);
      ctx.closePath();
      ctx.fillStyle = '#fbcfe8';
      ctx.fill();
      ctx.restore();
    }
  } else if (appearance.accessory === 'horns') {
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * HEAD_R * 0.48, -HEAD_R * 0.86);
      ctx.rotate(side * 0.16);
      ctx.beginPath();
      ctx.moveTo(-side * 8, 8);
      ctx.quadraticCurveTo(side * 16, -20, side * 26, -36);
      ctx.quadraticCurveTo(side * 10, -8, side * 10, 12);
      ctx.closePath();
      ctx.fillStyle = appearance.outfitAccent;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  } else if (appearance.accessory === 'glasses') {
    ctx.save();
    ctx.strokeStyle = 'rgba(244, 246, 251, 0.88)';
    ctx.lineWidth = 2.1;
    for (const side of [-1, 1]) {
      const gx = side * EYE_SPACING;
      const gy = -HEAD_R * 0.1;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.12)';
      ctx.beginPath();
      ctx.roundRect(gx - EYE_W - 4, gy - EYE_H * 0.85, (EYE_W + 4) * 2, EYE_H * 1.75, 7);
      ctx.fill();
      ctx.stroke();
    }
    // Bridge
    ctx.beginPath();
    ctx.moveTo(-EYE_SPACING + EYE_W + 4, -HEAD_R * 0.1);
    ctx.lineTo(EYE_SPACING - EYE_W - 4, -HEAD_R * 0.1);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  pose: PoseData | null,
  expression: ExpressionState,
  appearance: AvatarAppearance = DEFAULT_AVATAR_APPEARANCE,
  hairSway = 0,
) {
  ctx.save();

  const headTilt = pose ? (pose.xAngle || 0) * HEAD_TILT_GAIN : 0;
  const headTurn = pose ? (pose.yAngle || 0) * HEAD_TURN_GAIN : 0;
  const headRoll = pose ? (pose.zAngle || 0) * HEAD_ROLL_GAIN : 0;
  const sway = Math.max(-1, Math.min(1, hairSway));

  ctx.translate(CHAR_CENTER_X + headTurn, CHAR_CENTER_Y + headTilt);
  ctx.rotate((headRoll * Math.PI) / 180);

  drawBackAccessory(ctx, appearance, sway);

  // ---- Long hair tails (with dynamic sway physics) ----
  for (const side of [-1, 1]) {
    const tailShift = sway * 14;
    ctx.beginPath();
    ctx.moveTo(side * HEAD_R * 0.55, -HEAD_R * 0.1);
    ctx.quadraticCurveTo(
      side * HEAD_R * 1.35 + tailShift * 0.5,
      HEAD_R * 1.0,
      side * HEAD_R * 0.9 + tailShift,
      HEAD_R * 2.32,
    );
    ctx.quadraticCurveTo(
      side * HEAD_R * 0.75 + tailShift,
      HEAD_R * 2.42,
      side * HEAD_R * 0.55 + tailShift * 0.8,
      HEAD_R * 2.15,
    );
    ctx.quadraticCurveTo(
      side * HEAD_R * 0.85 + tailShift * 0.35,
      HEAD_R * 1.0,
      side * HEAD_R * 0.35,
      -HEAD_R * 0.05,
    );
    ctx.closePath();
    ctx.fillStyle = appearance.hairDark;
    ctx.fill();
  }

  // ---- Shoulders & Anime Outfit ----
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, HEAD_R * 2.38, HEAD_R * 1.32, HEAD_R * 1.56, 0, 0, Math.PI * 2);
  ctx.fillStyle = appearance.outfitColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Sailor / studio collar accent
  ctx.beginPath();
  ctx.moveTo(-HEAD_R * 0.56, HEAD_R * 1.15);
  ctx.lineTo(0, HEAD_R * 1.62);
  ctx.lineTo(HEAD_R * 0.56, HEAD_R * 1.15);
  ctx.lineTo(HEAD_R * 0.34, HEAD_R * 1.04);
  ctx.lineTo(0, HEAD_R * 1.38);
  ctx.lineTo(-HEAD_R * 0.34, HEAD_R * 1.04);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();

  // Center ribbon / tie
  ctx.beginPath();
  ctx.moveTo(-11, HEAD_R * 1.52);
  ctx.lineTo(11, HEAD_R * 1.52);
  ctx.lineTo(6, HEAD_R * 1.88);
  ctx.lineTo(-6, HEAD_R * 1.88);
  ctx.closePath();
  ctx.fillStyle = appearance.outfitAccent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, HEAD_R * 1.54, 7.5, 0, Math.PI * 2);
  ctx.fillStyle = appearance.outfitAccent;
  ctx.fill();
  ctx.restore();

  // ---- Back hair mass ----
  ctx.beginPath();
  ctx.ellipse(0, HEAD_R * 0.1, HEAD_R * 0.84, HEAD_R * 1.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = appearance.hairDark;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, HEAD_R * 0.1, HEAD_R * 0.84, HEAD_R * 1.12, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(0,0,0,0.14)';
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
  ctx.fillStyle = appearance.skinShade;
  ctx.fill();

  // ---- Face ----
  faceOutline(ctx, HEAD_R);
  ctx.fillStyle = appearance.skinColor;
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
  cheekGrad.addColorStop(1, 'rgba(255, 150, 130, 0.2)');
  ctx.fillStyle = cheekGrad;
  ctx.fillRect(-HEAD_R * 1.2, -HEAD_R * 1.2, HEAD_R * 2.4, HEAD_R * 2.4);
  ctx.restore();

  // ---- Blush ----
  const puffR = blushRadius(expression.cheekPuff);
  for (const side of [-1, 1]) {
    const bx = side * HEAD_R * 0.55;
    const by = HEAD_R * 0.35;
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, puffR);
    gradient.addColorStop(0, `rgba(255, 110, 150, ${0.42 + expression.cheekPuff * 0.28})`);
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

    if (expression.eyeSmile > 0.5) {
      ctx.beginPath();
      ctx.arc(ex, ey + EYE_H * 0.3, EYE_W * 0.9, Math.PI * 1.15, Math.PI * 1.85, true);
      ctx.strokeStyle = COL_OUTLINE;
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.stroke();
      continue;
    }

    const relaxedClose = (expression.relaxed ?? 0) * 0.48;
    const openAmt = Math.max(
      0.06,
      (side === -1 ? openness.left : openness.right) * (1 - relaxedClose),
    );
    const eh = EYE_H * openAmt;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, EYE_W, eh, 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#fff8fb';
    ctx.fillRect(ex - EYE_W, ey - eh, EYE_W * 2, eh * 2);

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
      irisGrad.addColorStop(0, appearance.eyeColor);
      irisGrad.addColorStop(0.7, appearance.eyeColor);
      irisGrad.addColorStop(1, appearance.eyeDark);
      ctx.beginPath();
      ctx.arc(irisX, irisY, irisR, 0, Math.PI * 2);
      ctx.fillStyle = irisGrad;
      ctx.fill();

      const pupilGrad = ctx.createRadialGradient(irisX, irisY, 0, irisX, irisY, PUPIL_R);
      pupilGrad.addColorStop(0, '#3a1c40');
      pupilGrad.addColorStop(1, COL_PUPIL);
      ctx.beginPath();
      ctx.arc(irisX, irisY, PUPIL_R, 0, Math.PI * 2);
      ctx.fillStyle = pupilGrad;
      ctx.fill();

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
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fill();
    }

    const socketShade = ctx.createLinearGradient(ex, ey - eh, ex, ey - eh * 0.3);
    socketShade.addColorStop(0, 'rgba(120,60,80,0.22)');
    socketShade.addColorStop(1, 'rgba(120,60,80,0)');
    ctx.fillStyle = socketShade;
    ctx.fillRect(ex - EYE_W, ey - eh, EYE_W * 2, eh);
    ctx.restore();

    ctx.beginPath();
    ctx.ellipse(ex, ey - eh * 0.55, EYE_W * 0.85, eh * 0.4, 0, Math.PI * 1.15, Math.PI * 1.85);
    ctx.strokeStyle = 'rgba(92,44,71,0.22)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';
    ctx.stroke();

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

  // ---- Eyebrows ----
  const browLift = expression.eyebrowRaise * HEAD_R * 0.12;
  const angryTilt = (expression.angry ?? 0) * HEAD_R * 0.11;
  const sadTilt = (expression.sad ?? 0) * HEAD_R * 0.1;
  for (const side of [-1, 1]) {
    const innerY = -HEAD_R * 0.42 - browLift + angryTilt - sadTilt;
    const outerY = -HEAD_R * 0.4 - browLift - angryTilt * 0.6 + sadTilt * 0.8;
    ctx.beginPath();
    ctx.moveTo(side * (EYE_SPACING - 14), innerY);
    ctx.quadraticCurveTo(
      side * EYE_SPACING,
      -HEAD_R * 0.5 - browLift + angryTilt * 0.3,
      side * (EYE_SPACING + 13),
      outerY,
    );
    ctx.strokeStyle = appearance.hairDark;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // ---- Nose ----
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-1.5, HEAD_R * 0.02);
  ctx.quadraticCurveTo(1, HEAD_R * 0.15, 2.5, HEAD_R * 0.25);
  ctx.strokeStyle = 'rgba(120,70,60,0.28)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(1.5, HEAD_R * 0.26, 2.6, 1.6, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,235,225,0.5)';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(3, HEAD_R * 0.29, 1.6, 1, 0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(160,90,80,0.22)';
  ctx.fill();
  ctx.restore();

  // ---- Jaw/chin & forehead shading ----
  ctx.save();
  faceOutline(ctx, HEAD_R);
  ctx.clip();
  const jawGrad = ctx.createLinearGradient(0, HEAD_R * 0.55, 0, HEAD_R * 1.15);
  jawGrad.addColorStop(0, 'rgba(180,110,95,0)');
  jawGrad.addColorStop(1, 'rgba(180,110,95,0.26)');
  ctx.fillStyle = jawGrad;
  ctx.fillRect(-HEAD_R * 1.2, HEAD_R * 0.4, HEAD_R * 2.4, HEAD_R * 0.9);
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

  // ---- Mouth ----
  const mouthOpen = mouthOpening(pose ? pose.mouthRatio : null, expression.mouthOpen);
  if (mouthOpen < 2) {
    const moodCurve =
      5 + expression.eyeSmile * 4 - (expression.sad ?? 0) * 9 - (expression.angry ?? 0) * 7;
    ctx.beginPath();
    ctx.moveTo(-MOUTH_MAX_W * 0.55, MOUTH_Y);
    ctx.quadraticCurveTo(0, MOUTH_Y + moodCurve, MOUTH_MAX_W * 0.55, MOUTH_Y);
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
  hairGrad.addColorStop(0, appearance.hairLight);
  hairGrad.addColorStop(1, appearance.hairColor);
  ctx.fillStyle = hairGrad;
  ctx.fill();

  // Anime hair highlight halo arc
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -HEAD_R * 0.45, HEAD_R * 0.5, Math.PI * 1.18, Math.PI * 1.44);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -HEAD_R * 0.45, HEAD_R * 0.5, Math.PI * 1.56, Math.PI * 1.82);
  ctx.stroke();
  ctx.restore();

  // ---- Side locks (with dynamic sway) ----
  for (const side of [-1, 1]) {
    const lockShift = sway * 7;
    ctx.beginPath();
    ctx.moveTo(side * HEAD_R * 0.82, -HEAD_R * 0.32);
    ctx.quadraticCurveTo(
      side * HEAD_R * 1.1 + lockShift * 0.5,
      HEAD_R * 0.3,
      side * HEAD_R * 0.8 + lockShift,
      HEAD_R * 0.96,
    );
    ctx.quadraticCurveTo(
      side * HEAD_R * 0.62 + lockShift * 0.4,
      HEAD_R * 0.5,
      side * HEAD_R * 0.6,
      -HEAD_R * 0.22,
    );
    ctx.closePath();
    const lockGrad = ctx.createLinearGradient(
      side * HEAD_R * 0.6,
      -HEAD_R * 0.3,
      side * HEAD_R * 1.1,
      HEAD_R * 0.9,
    );
    lockGrad.addColorStop(0, appearance.hairLight);
    lockGrad.addColorStop(1, appearance.hairColor);
    ctx.fillStyle = lockGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(92,44,71,0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // ---- Foreground Accessories (ears / horns / glasses) ----
  drawTopAccessory(ctx, appearance, sway);

  ctx.restore();
}

const overlayImageCache = new Map<string, HTMLImageElement>();

function getOverlayImage(src: string): HTMLImageElement | null {
  if (!src || !/^(?:data:image\/|blob:)/i.test(src) || typeof Image === 'undefined') {
    return null;
  }
  let img = overlayImageCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    overlayImageCache.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export function drawOverlays(ctx: CanvasRenderingContext2D, overlays: OverlayItem[]) {
  for (const item of overlays) {
    if (!item.content.trim()) continue;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, item.opacity));
    ctx.translate(item.x * CANVAS_SIZE, item.y * CANVAS_SIZE);
    ctx.rotate((item.rotation * Math.PI) / 180);

    if (item.type === 'emoji') {
      ctx.font = `${32 * item.scale}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.content, 0, 0);
    } else if (item.type === 'text') {
      ctx.font = `700 ${20 * item.scale}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, 3 * item.scale);
      ctx.strokeStyle = 'rgba(10, 10, 12, 0.85)';
      ctx.strokeText(item.content, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(item.content, 0, 0);
    } else if (item.type === 'image') {
      const img = getOverlayImage(item.content);
      if (img) {
        const baseSize = 72 * item.scale;
        const aspect = img.naturalWidth / img.naturalHeight;
        const w = aspect >= 1 ? baseSize : baseSize * aspect;
        const h = aspect >= 1 ? baseSize / aspect : baseSize;
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
      }
    }

    ctx.restore();
  }
}

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  pose: PoseData | null,
  tracking: boolean,
  size = CANVAS_SIZE,
) {
  if (pose) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
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
