import type { BackgroundType } from '../types';

/**
 * Draw the active stage background (solid color, CSS linear-gradient, dim matte,
 * custom image, or transparent clear) onto any 2D canvas context.
 *
 * Used by PNG snapshots, WebM clip recording, and the Pop-Out OBS Stage Window
 * so exported media and broadcast captures accurately match the studio stage.
 */
export function drawStageBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  background: BackgroundType,
  backgroundValue: string,
  bgImage?: HTMLImageElement | null,
): void {
  ctx.clearRect(0, 0, width, height);

  if (background === 'none') {
    return;
  }

  if (background === 'image' && bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    const imgAspect = bgImage.naturalWidth / Math.max(bgImage.naturalHeight, 1);
    const dstAspect = width / Math.max(height, 1);
    let sx = 0;
    let sy = 0;
    let sw = bgImage.naturalWidth;
    let sh = bgImage.naturalHeight;
    if (imgAspect > dstAspect) {
      sw = bgImage.naturalHeight * dstAspect;
      sx = (bgImage.naturalWidth - sw) / 2;
    } else {
      sh = bgImage.naturalWidth / dstAspect;
      sy = (bgImage.naturalHeight - sh) / 2;
    }
    ctx.drawImage(bgImage, sx, sy, sw, sh, 0, 0, width, height);
    return;
  }

  if (background === 'blur') {
    ctx.fillStyle = backgroundValue || 'rgba(8, 9, 13, 0.72)';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const trimmed = (backgroundValue || '').trim();
  if (/^linear-gradient\(/i.test(trimmed)) {
    const parsed = parseLinearGradient(ctx, trimmed, width, height);
    if (parsed) {
      ctx.fillStyle = parsed;
      ctx.fillRect(0, 0, width, height);
      return;
    }
  }

  ctx.fillStyle = trimmed && trimmed !== 'transparent' ? trimmed : '#0a0a0c';
  ctx.fillRect(0, 0, width, height);
}

function parseLinearGradient(
  ctx: CanvasRenderingContext2D,
  css: string,
  width: number,
  height: number,
): CanvasGradient | null {
  const innerMatch = /^linear-gradient\((.+)\)$/i.exec(css);
  if (!innerMatch?.[1]) return null;

  const parts = splitTopLevelCommas(innerMatch[1]);
  if (parts.length < 2) return null;

  let angleDeg = 180;
  let stopStart = 0;
  const first = parts[0]?.trim() ?? '';
  const degMatch = /^(-?\d+(?:\.\d+)?)deg$/i.exec(first);
  if (degMatch?.[1]) {
    angleDeg = parseFloat(degMatch[1]);
    stopStart = 1;
  }

  const stops = parts.slice(stopStart).map((s) => s.trim());
  if (stops.length < 2) return null;

  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const halfLen = (Math.abs(width * Math.cos(rad)) + Math.abs(height * Math.sin(rad))) / 2;
  const dx = Math.cos(rad) * halfLen;
  const dy = Math.sin(rad) * halfLen;

  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (let i = 0; i < stops.length; i += 1) {
    const token = stops[i]!;
    const pctMatch = /(-?\d+(?:\.\d+)?)%\s*$/.exec(token);
    const pos = pctMatch?.[1]
      ? Math.max(0, Math.min(1, parseFloat(pctMatch[1]) / 100))
      : i / Math.max(stops.length - 1, 1);
    const color = pctMatch ? token.slice(0, pctMatch.index).trim() : token;
    try {
      grad.addColorStop(pos, color);
    } catch {
      return null;
    }
  }
  return grad;
}

function splitTopLevelCommas(input: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input) {
    if (ch === '(') depth += 1;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) result.push(current);
  return result;
}
