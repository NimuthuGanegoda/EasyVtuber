import { useEffect, useRef } from 'react';
import type { Landmark } from '../utils/poseExtractor';
import { XIcon } from './Icons';

// Key MediaPipe FaceMesh contour indices for lightweight, crisp 60fps overlay
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148,
  176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10,
];
const LEFT_EYE = [33, 160, 158, 133, 153, 144, 33];
const RIGHT_EYE = [362, 385, 387, 263, 373, 380, 362];
const LIPS_OUTER = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61,
];
const LEFT_BROW = [70, 63, 105, 66, 107];
const RIGHT_BROW = [336, 296, 334, 293, 300];

const PREVIEW_W = 192;
const PREVIEW_H = 144;

function drawPolyline(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  indices: number[],
  w: number,
  h: number,
) {
  ctx.beginPath();
  let started = false;
  for (const idx of indices) {
    const pt = landmarks[idx];
    if (!pt) continue;
    // Mirror horizontally to match natural selfie view
    const x = (1 - pt.x) * w;
    const y = pt.y * h;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

export function WebcamPreview({
  videoRef,
  landmarksRef,
  onClose,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  landmarksRef: React.MutableRefObject<Landmark[] | null>;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const draw = () => {
      ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
      const video = videoRef.current;
      if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        ctx.save();
        ctx.translate(PREVIEW_W, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, PREVIEW_W, PREVIEW_H);
        ctx.restore();
      } else {
        ctx.fillStyle = '#0e1017';
        ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Camera Standby', PREVIEW_W / 2, PREVIEW_H / 2);
      }

      const landmarks = landmarksRef.current;
      if (landmarks && landmarks.length >= 468) {
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.75)';
        drawPolyline(ctx, landmarks, FACE_OVAL, PREVIEW_W, PREVIEW_H);

        ctx.strokeStyle = 'rgba(52, 211, 153, 0.9)';
        drawPolyline(ctx, landmarks, LEFT_EYE, PREVIEW_W, PREVIEW_H);
        drawPolyline(ctx, landmarks, RIGHT_EYE, PREVIEW_W, PREVIEW_H);

        ctx.strokeStyle = 'rgba(167, 139, 250, 0.9)';
        drawPolyline(ctx, landmarks, LEFT_BROW, PREVIEW_W, PREVIEW_H);
        drawPolyline(ctx, landmarks, RIGHT_BROW, PREVIEW_W, PREVIEW_H);

        ctx.strokeStyle = 'rgba(251, 191, 36, 0.9)';
        drawPolyline(ctx, landmarks, LIPS_OUTER, PREVIEW_W, PREVIEW_H);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [videoRef, landmarksRef]);

  return (
    <div className="webcam-pip" role="region" aria-label="Webcam face mesh preview">
      <div className="webcam-pip-bar">
        <span>Face Mesh</span>
        <button
          type="button"
          className="perf-close"
          onClick={onClose}
          aria-label="Hide camera preview"
        >
          <XIcon size={12} />
        </button>
      </div>
      <canvas ref={canvasRef} width={PREVIEW_W} height={PREVIEW_H} className="webcam-pip-canvas" />
    </div>
  );
}
