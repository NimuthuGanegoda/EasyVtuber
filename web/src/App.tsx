import { useRef, useEffect, useState } from 'react';
import { useVtuber, BackgroundType, OverlayItem, PoseData, ExpressionState } from './hooks/useVtuber';
import { useContributors, FALLBACK_COUNT } from './hooks/useContributors';
import { WebGLCharacterRenderer } from './utils/webglRenderer';
import { VRMCharacterRenderer } from './utils/vrmRenderer';

// Path to a real VRM character model, if one has been supplied (see
// web/README, "Character model"). Progressive enhancement: if this 404s,
// VRMCharacterRenderer.loadModel() fails gracefully and the app falls back
// to the procedural WebGL/Canvas2D renderer below, so the app still works
// with no model present.
const VRM_MODEL_URL = './models/character.vrm';
import { PerformanceMonitor } from './components/PerformanceMonitor';

// Character rendering constants
const CHAR_CENTER_X = 256;
const CHAR_CENTER_Y = 230;
const HEAD_R = 66;
const EYE_SPACING = 24;
const EYE_W = 13;
const EYE_H = 16;
const PUPIL_R = 4;
// Relative to head center (was 240 -- combined with the origin translate
// that put the mouth at canvas y~460, well below the body, not on the face).
const MOUTH_Y = 34;
const MOUTH_MAX_W = 20;

const COL_SKIN = '#ffe3d6';
const COL_SKIN_SHADE = '#ffcbb8';
const COL_HAIR = '#ff5c94';
const COL_HAIR_DARK = '#d63d75';
const COL_HAIR_LIGHT = '#ff9dc0';
const COL_IRIS = '#a34fd6';
const COL_IRIS_DARK = '#6b2a94';
const COL_PUPIL = '#2a1030';
const COL_OUTLINE = '#5c2c47';
const COL_MOUTH = '#c23f6b';
const COL_MOUTH_INNER = '#7a1f3d';

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

// Per-frame pose values come straight from tracking with no temporal
// smoothing, so tiny per-frame tracking noise reads as mechanical jitter.
// Lerp toward the target each frame instead of snapping to it — different
// rates per field, since blinks should stay snappy while head rotation
// (the most jitter-visible signal) benefits from heavier smoothing.
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function smoothPose(target: PoseData | null, prev: PoseData | null): PoseData | null {
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

function drawCharacter(ctx: CanvasRenderingContext2D, pose: PoseData | null, expression: ExpressionState) {
  ctx.save();

  const headTilt = pose ? (pose.xAngle || 0) * 40 : 0;
  const headTurn = pose ? (pose.yAngle || 0) * 30 : 0;
  const headRoll = pose ? (pose.zAngle || 0) * 6 : 0;

  ctx.translate(CHAR_CENTER_X + headTurn, CHAR_CENTER_Y + headTilt);
  ctx.rotate(headRoll * Math.PI / 180);

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
  const cheekGrad = ctx.createRadialGradient(0, HEAD_R * 0.55, HEAD_R * 0.1, 0, HEAD_R * 0.55, HEAD_R * 0.85);
  cheekGrad.addColorStop(0, 'rgba(255, 170, 150, 0)');
  cheekGrad.addColorStop(1, 'rgba(255, 150, 130, 0.22)');
  ctx.fillStyle = cheekGrad;
  ctx.fillRect(-HEAD_R * 1.2, -HEAD_R * 1.2, HEAD_R * 2.4, HEAD_R * 2.4);
  ctx.restore();

  // ---- Blush ---- (manual "cheek puff" override enlarges + darkens it)
  const puffR = 17 + expression.cheekPuff * 10;
  for (const side of [-1, 1]) {
    const bx = side * HEAD_R * 0.55, by = HEAD_R * 0.35;
    const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, puffR);
    gradient.addColorStop(0, `rgba(255, 110, 150, ${0.45 + expression.cheekPuff * 0.25})`);
    gradient.addColorStop(1, 'rgba(255, 110, 150, 0)');
    ctx.beginPath();
    ctx.arc(bx, by, puffR, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // ---- Eyes ----
  const eyeOpenL = pose ? Math.max(0.06, 1 - pose.eyeLHTemp) : 1;
  const eyeOpenR = pose ? Math.max(0.06, 1 - pose.eyeRHTemp) : 1;
  const eyeXOffset = pose ? Math.max(-4, Math.min(4, pose.eyeXRatio * 3)) : 0;
  const eyeYOffset = pose ? Math.max(-3, Math.min(3, pose.eyeYRatio * 3)) : 0;

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

    const openAmt = side === -1 ? eyeOpenL : eyeOpenR;
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
    const irisY = ey + eh * 0.15 + eyeYOffset;
    const irisX = ex + eyeXOffset;

    if (openAmt > 0.15) {
      const irisR = EYE_W * 0.66;
      const irisGrad = ctx.createRadialGradient(
        irisX - 2, irisY - irisR * 0.5, 1,
        irisX, irisY, irisR
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
    ctx.quadraticCurveTo(side * EYE_SPACING, -HEAD_R * 0.5 - browLift, side * (EYE_SPACING + 13), -HEAD_R * 0.4 - browLift);
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
  const foreheadGrad = ctx.createRadialGradient(0, -HEAD_R * 0.55, 0, 0, -HEAD_R * 0.55, HEAD_R * 0.6);
  foreheadGrad.addColorStop(0, 'rgba(255,255,250,0.25)');
  foreheadGrad.addColorStop(1, 'rgba(255,255,250,0)');
  ctx.fillStyle = foreheadGrad;
  ctx.fillRect(-HEAD_R * 1.2, -HEAD_R * 1.2, HEAD_R * 2.4, HEAD_R * 1.2);
  ctx.restore();

  // ---- Mouth ---- (manual "mouth open" override forces it wide, whichever is bigger wins)
  const mouthOpen = Math.max(pose ? Math.min(pose.mouthRatio * 26, 22) : 0, expression.mouthOpen * 18);
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
    const lockGrad = ctx.createLinearGradient(side * HEAD_R * 0.6, -HEAD_R * 0.3, side * HEAD_R * 1.1, HEAD_R * 0.9);
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

function drawOverlays(ctx: CanvasRenderingContext2D, overlays: OverlayItem[]) {
  overlays.forEach((item) => {
    if (item.type === 'emoji') {
      ctx.save();
      ctx.font = `${32 * item.scale}px serif`;
      ctx.globalAlpha = item.opacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(item.x * 512, item.y * 512);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.fillText(item.content, 0, 0);
      ctx.restore();
    }
  });
}

function drawHUD(ctx: CanvasRenderingContext2D, pose: PoseData | null, tracking: boolean) {
  if (!pose) return;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Eyes: L${(pose.eyeLHTemp * 100).toFixed(0)}% R${(pose.eyeRHTemp * 100).toFixed(0)}%`, 12, 12);
  ctx.fillText(`Mouth: ${(pose.mouthRatio * 100).toFixed(0)}%`, 12, 28);
  ctx.fillText(`Head: ${(pose.headX * 10).toFixed(1)}°/${(pose.headY * 10).toFixed(1)}°`, 12, 44);

  if (!tracking) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSED', 256, 256);
    ctx.restore();
  }
}

function ContributorsSection() {
  const { contributors, loading, error } = useContributors();

  if (loading) {
    return (
      <div className="contributors-list">
        {Array.from({ length: FALLBACK_COUNT }, (_, i) => (
          <div key={i} className="contributor-row skeleton-row">
            <div className="skeleton-circle" />
            <div className="contributor-info">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-xs" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="contributors-list">
      {error && (
        <div className="contributor-fallback-hint" title={error}>
          <span className="contributors-badge">CACHED</span>
        </div>
      )}
      {contributors.map((c, i) => (
        <a
          key={i}
          href={c.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="contributor-row"
        >
          <div className="contributor-avatar-wrapper">
            <img
              className="contributor-avatar"
              src={c.avatar_url}
              alt={c.name}
              loading="lazy"
            />
          </div>
          <div className="contributor-info">
            <span className="contributor-name">
              {c.emoji} {c.name}
            </span>
            <span className="contributor-role">{c.role}</span>
          </div>
          {c.contributions > 0 && (
            <span className="contributor-contributions" title={`${c.contributions} contributions`}>
              {c.contributions}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglRendererRef = useRef<WebGLCharacterRenderer | null>(null);
  const vrmCanvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRendererRef = useRef<VRMCharacterRenderer | null>(null);
  const [activeTab, setActiveTab] = useState<'expressions' | 'backgrounds' | 'overlays' | 'hotkeys' | 'settings'>('expressions');
  const initStarted = useRef(false);
  const animFrameRef = useRef(0);
  const smoothedPoseRef = useRef<PoseData | null>(null);

  const vtuber = useVtuber();

  // Init tracking on mount
  useEffect(() => {
    if (videoRef.current && !initStarted.current) {
      initStarted.current = true;
      vtuber.loadModels(videoRef.current);
    }
  }, [vtuber.loadModels]);

  // Initialize WebGL renderer on the hidden GL canvas
  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    if (!glCanvas) return;
    glCanvas.width = 512;
    glCanvas.height = 512;
    try {
      webglRendererRef.current = new WebGLCharacterRenderer(glCanvas);
    } catch {
      console.warn('WebGL renderer init failed, falling back to Canvas 2D');
    }

    return () => {
      webglRendererRef.current?.destroy();
      webglRendererRef.current = null;
    };
  }, []);

  // Initialize the VRM (real character model) renderer on its own hidden
  // canvas — separate from the procedural gl-canvas since they're two
  // independent WebGL contexts. Progressive enhancement: loadModel()
  // resolves false if no model is present or it fails to load, and the
  // render loop below falls back to the procedural renderer in that case.
  useEffect(() => {
    const vrmCanvas = vrmCanvasRef.current;
    if (!vrmCanvas) return;
    vrmCanvas.width = 512;
    vrmCanvas.height = 512;
    let cancelled = false;
    try {
      const renderer = new VRMCharacterRenderer(vrmCanvas);
      vrmRendererRef.current = renderer;
      renderer.loadModel(VRM_MODEL_URL).then((ok) => {
        if (!ok && !cancelled) {
          console.info('No VRM character model loaded — using procedural fallback renderer.');
        }
      });
    } catch (e) {
      console.warn('VRM renderer init failed, falling back:', e);
    }

    return () => {
      cancelled = true;
      vrmRendererRef.current?.destroy();
      vrmRendererRef.current = null;
    };
  }, []);

  // Single persistent RAF render loop — WebGL for character, Canvas 2D for overlays/HUD
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 512;

    let running = true;
    const render = () => {
      if (!running) return;
      ctx.clearRect(0, 0, 512, 512);

      // Read fresh pose/overlay data from refs — updates every frame without React
      const rawPose = vtuber.poseRef.current;
      smoothedPoseRef.current = smoothPose(rawPose, smoothedPoseRef.current);
      const currentPose = smoothedPoseRef.current;
      const currentOverlays = vtuber.overlaysRef.current;
      const isTracking = vtuber.trackingRef.current;

      // Fallback chain: real VRM character model (if one is present) ->
      // procedural WebGL shapes -> Canvas2D shapes. VRM is driven straight
      // from raw landmarks (Kalidokit does its own solving), not the
      // derived/smoothed PoseData the other two renderers use.
      const vrmRenderer = vrmRendererRef.current;
      const vrmDrawn = vrmRenderer?.isReady()
        ? vrmRenderer.render(vtuber.landmarksRef.current)
        : false;

      const gl = webglRendererRef.current;
      const webglDrawn = !vrmDrawn && gl ? gl.render(currentPose, vtuber.expressionRef.current) : false;

      if (vrmDrawn && vrmCanvasRef.current) {
        ctx.drawImage(vrmCanvasRef.current, 0, 0);
      } else if (webglDrawn && glCanvasRef.current) {
        // Composite WebGL output onto the 2D canvas
        ctx.drawImage(glCanvasRef.current, 0, 0);
      } else {
        // Fallback: draw character with Canvas 2D
        drawCharacter(ctx, currentPose, vtuber.expressionRef.current);
      }

      // Overlays and HUD always render on Canvas 2D (text/compositing)
      drawOverlays(ctx, currentOverlays);
      drawHUD(ctx, currentPose, isTracking);

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
    // vtuber refs are stable — no deps needed, this effect runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo-text">EasyVtuber</div>
          <span className="logo-badge">STUDIO</span>
        </div>
        <div className="header-center">
          <div className={`status-indicator ${vtuber.isLoaded ? 'online' : 'offline'}`} />
          <span className="status-text">{vtuber.status}</span>
        </div>
        <div className="header-right">
          <div className="fps-display">
            <span className="fps-value">{vtuber.fps}</span>
            <span className="fps-label">FPS</span>
          </div>
          <div className="inference-display">
            <span className="inf-value">{vtuber.inferenceTime}</span>
            <span className="inf-label">ms</span>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {/* Left Panel - Controls */}
        <aside className="left-panel">
          {/* Tab Navigation */}
          <div className="tab-nav">
            {[
              { id: 'expressions' as const, label: 'Expressions', icon: '😊' },
              { id: 'backgrounds' as const, label: 'Backgrounds', icon: '🎨' },
              { id: 'overlays' as const, label: 'Overlays', icon: '✨' },
              { id: 'hotkeys' as const, label: 'Hotkeys', icon: '⌨️' },
              { id: 'settings' as const, label: 'Settings', icon: '⚙️' },
            ].map(tab => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Expressions Panel */}
            {activeTab === 'expressions' && (
              <div className="panel">
                <h3 className="panel-title">Facial Expressions</h3>
                <div className="expression-grid">
                  {[
                    { key: 'mouthOpen' as const, label: 'Mouth Open', icon: '👄' },
                    { key: 'eyebrowRaise' as const, label: 'Eyebrow', icon: '🤨' },
                    { key: 'eyeSmile' as const, label: 'Eye Smile', icon: '😊' },
                    { key: 'cheekPuff' as const, label: 'Cheek Puff', icon: '😤' },
                  ].map(expr => (
                    <button
                      key={expr.key}
                      className={`expr-btn ${vtuber.expression[expr.key] > 0.5 ? 'active' : ''}`}
                      onClick={() => vtuber.setExpression({
                        [expr.key]: vtuber.expression[expr.key] > 0.5 ? 0 : 1,
                      })}
                    >
                      <span className="expr-icon">{expr.icon}</span>
                      <span className="expr-label">{expr.label}</span>
                      <div className="expr-slider">
                        <div
                          className="expr-fill"
                          style={{ width: `${vtuber.expression[expr.key] * 100}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
                <button className="btn-secondary" onClick={vtuber.resetExpression}>
                  Reset All Expressions
                </button>

                <h3 className="panel-title" style={{ marginTop: 24 }}>Tracking</h3>
                <div className="tracking-controls">
                  <button
                    className={`ctrl-btn ${vtuber.isTracking ? '' : 'paused'}`}
                    onClick={vtuber.toggleTracking}
                  >
                    {vtuber.isTracking ? '⏸ Pause Tracking' : '▶ Resume Tracking'}
                  </button>
                  <button
                    className={`ctrl-btn ${vtuber.handTracking ? 'active' : ''}`}
                    onClick={() => vtuber.setState({ handTracking: !vtuber.handTracking })}
                    disabled
                  >
                    🖐 Hand Tracking
                  </button>
                </div>
              </div>
            )}

            {/* Backgrounds Panel */}
            {activeTab === 'backgrounds' && (
              <div className="panel">
                <h3 className="panel-title">Scene Backgrounds</h3>
                <div className="background-grid">
                  {[
                    { id: 'gradient' as BackgroundType, label: 'Cyberpunk', colors: ['#0a0a0c', '#1a1a2e', '#16213e'], gradientStr: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)' },
                    { id: 'gradient' as BackgroundType, label: 'Sunset', colors: ['#ff6b6b', '#ffa500', '#ffd93d'], gradientStr: 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 50%, #ffd93d 100%)' },
                    { id: 'gradient' as BackgroundType, label: 'Forest', colors: ['#0f3443', '#34e89e', '#1a2a1a'], gradientStr: 'linear-gradient(135deg, #0f3443 0%, #34e89e 50%, #1a2a1a 100%)' },
                    { id: 'gradient' as BackgroundType, label: 'Ocean', colors: ['#0072ff', '#00c6ff', '#0a1628'], gradientStr: 'linear-gradient(135deg, #0072ff 0%, #00c6ff 50%, #0a1628 100%)' },
                    { id: 'gradient' as BackgroundType, label: 'Lavender', colors: ['#667eea', '#764ba2', '#1a0a2e'], gradientStr: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #1a0a2e 100%)' },
                    { id: 'gradient' as BackgroundType, label: 'Crimson', colors: ['#200122', '#6f0000', '#1a0a0a'], gradientStr: 'linear-gradient(135deg, #200122 0%, #6f0000 50%, #1a0a0a 100%)' },
                    { id: 'none' as BackgroundType, label: 'Transparent', colors: ['#000000', '#000000'], gradientStr: 'transparent' },
                    { id: 'blur' as BackgroundType, label: 'Blur Dark', colors: ['#0a0a0c', '#0a0a0c'], gradientStr: 'rgba(0,0,0,0.6)' },
                  ].map((bg, i) => (
                    <button
                      key={`${bg.id}-${i}`}
                      className={`bg-btn ${vtuber.backgroundValue === (bg.gradientStr || bg.colors[0]) ? 'active' : ''}`}
                      onClick={() => {
                        if (bg.id === 'gradient') {
                          vtuber.setBackground('gradient', bg.gradientStr!);
                        } else {
                          vtuber.setBackground(bg.id);
                        }
                      }}
                    >
                      <div
                        className="bg-preview"
                        style={{
                          background: bg.colors.length >= 3
                            ? `linear-gradient(135deg, ${bg.colors[0]}, ${bg.colors[1]}, ${bg.colors[2]})`
                            : bg.colors[0],
                        }}
                      />
                      <span className="bg-label">{bg.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Overlays Panel */}
            {activeTab === 'overlays' && (
              <div className="panel">
                <h3 className="panel-title">Overlay Items</h3>
                <div className="overlay-list">
                  {vtuber.overlays.map(item => (
                    <div key={item.id} className="overlay-item">
                      <div className="overlay-preview">
                        {item.type === 'emoji' ? (
                          <span style={{ fontSize: 24 }}>{item.content}</span>
                        ) : (
                          <span className="overlay-type-badge">{item.type}</span>
                        )}
                      </div>
                      <div className="overlay-controls">
                        <label>
                          Opacity
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.opacity}
                            onChange={e => vtuber.updateOverlay(item.id, { opacity: parseFloat(e.target.value) })}
                          />
                        </label>
                        <label>
                          Scale
                          <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={item.scale}
                            onChange={e => vtuber.updateOverlay(item.id, { scale: parseFloat(e.target.value) })}
                          />
                        </label>
                      </div>
                      <button
                        className="btn-icon danger"
                        onClick={() => vtuber.removeOverlay(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="overlay-add">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const emojis = ['🌸', '⭐', '❤️', '✨', '🎀', '💫', '🌟', '💖'];
                      const emoji = emojis[Math.floor(Math.random() * emojis.length)] ?? '🌸';
                      vtuber.addOverlay({
                        id: String(Date.now()),
                        type: 'emoji',
                        content: emoji,
                        x: 0.2 + Math.random() * 0.6,
                        y: 0.2 + Math.random() * 0.6,
                        scale: 1,
                        rotation: 0,
                        opacity: 0.8,
                      });
                    }}
                  >
                    ✨ Add Decoration
                  </button>
                </div>
              </div>
            )}

            {/* Hotkeys Panel */}
            {activeTab === 'hotkeys' && (
              <div className="panel">
                <h3 className="panel-title">Keyboard Shortcuts</h3>
                <div className="hotkey-list">
                  {vtuber.hotkeys.map((hk, i) => (
                    <div key={i} className="hotkey-row">
                      <div className="hotkey-key">
                        <kbd>{hk.key === ' ' ? 'Space' : hk.key.toUpperCase()}</kbd>
                      </div>
                      <span className="hotkey-action">{hk.label}</span>
                    </div>
                  ))}
                </div>
                <p className="panel-hint">
                  Press these keys during your stream to trigger actions
                </p>
              </div>
            )}

            {/* Settings Panel */}
            {activeTab === 'settings' && (
              <div className="panel">
                <h3 className="panel-title">Settings</h3>
                <div className="setting-group">
                  <div className="setting-row">
                    <span>Camera Source</span>
                    <select className="setting-select">
                      <option>Default Webcam</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Model Quality</span>
                    <select className="setting-select" defaultValue="gpu">
                      <option value="gpu">GPU (Fast)</option>
                      <option value="cpu">CPU (Fallback)</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Max FPS</span>
                    <select className="setting-select" defaultValue="30">
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="60">60</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Show Debug Info</span>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="setting-row">
                    <span>Auto-Start Tracking</span>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="setting-row">
                    <span>
                      Worker Extraction
                      <span
                        className={`worker-indicator ${vtuber.useWorker ? 'active' : ''}`}
                        title={vtuber.useWorker ? 'Off-thread pose extraction active' : 'Using main-thread extraction'}
                      />
                    </span>
                    <label className="toggle">
                      <input
                        type="checkbox"
                        checked={vtuber.useWorker}
                        onChange={e => vtuber.setUseWorker(e.target.checked)}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Center - Main Viewport */}
        <main className="viewport">
          <div
            className="render-canvas-wrapper"
            style={{
              background: vtuber.background === 'gradient'
                ? vtuber.backgroundValue
                : vtuber.background === 'blur'
                  ? 'rgba(0,0,0,0.7)'
                  : vtuber.background === 'game'
                    ? '#1a1a2e'
                    : 'transparent',
            }}
          >
            {/* Hidden video element for camera input */}
            <video
              ref={videoRef}
              className="input-video"
              playsInline
              muted
            />

            {/* Hidden WebGL canvas for GPU-accelerated character rendering */}
            <canvas
              ref={glCanvasRef}
              className="gl-canvas"
            />

            {/* Hidden canvas for the real VRM character model, when present */}
            <canvas
              ref={vrmCanvasRef}
              className="gl-canvas"
            />

            {/* Main 2D canvas for overlays, HUD, and fallback rendering */}
            <canvas
              ref={overlayCanvasRef}
              className={`overlay-canvas ${vtuber.isLoaded ? '' : 'canvas-hidden'}`}
            />

            {/* Placeholder overlay when not loaded */}
            {!vtuber.isLoaded && (
              <div className="viewport-placeholder">
                {vtuber.error ? (
                  <div className="error-state">
                    <div className="error-icon">⚠️</div>
                    <p className="error-text">{vtuber.error}</p>
                    <button
                      className="btn-primary"
                      onClick={() => window.location.reload()}
                    >
                      Restart System
                    </button>
                  </div>
                ) : (
                  <div className="loading-state">
                    <div className="loading-spinner" />
                    <p className="loading-text">{vtuber.status}</p>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${vtuber.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Top-right status overlay */}
            {vtuber.isLoaded && (
              <div className="viewport-hud">
                <div className="hud-tracking">
                  <div className={`hud-dot ${vtuber.isTracking ? 'active' : ''}`} />
                  {vtuber.isTracking ? 'LIVE' : 'PAUSED'}
                </div>
                {vtuber.pose && (
                  <div className="hud-pose">
                    {`H:${(vtuber.pose.headX * 10).toFixed(1)}°`}
                    {` V:${(vtuber.pose.headY * 10).toFixed(1)}°`}
                  </div>
                )}
              </div>
            )}

            {/* Performance Monitor overlay */}
            <PerformanceMonitor
              fps={vtuber.fps}
              inferenceTime={vtuber.inferenceTime}
              isTracking={vtuber.isTracking}
            />
          </div>
        </main>

        {/* Right Panel - Live Stats & Info */}
        <aside className="right-panel">
          {/* Sakura - AI Assistant */}
          <div className="assistant-card">
            <img
              className="assistant-avatar"
              src="https://api.dicebear.com/9.x/lorelei/svg?seed=Sakura&backgroundColor=ffb7c5&radius=50"
              alt="Sakura"
            />
            <div className="assistant-info">
              <span className="assistant-name">Sakura</span>
              <span className="assistant-title">AI Assistant</span>
            </div>
            <span className="assistant-status" />
          </div>

          <h3 className="panel-title">Live Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{vtuber.fps}</div>
              <div className="stat-label">FPS</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{vtuber.inferenceTime}</div>
              <div className="stat-label">Inference (ms)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {vtuber.pose ? (vtuber.pose.mouthRatio * 100).toFixed(0) : '-'}
              </div>
              <div className="stat-label">Mouth Open %</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {vtuber.pose ? `${(vtuber.pose.headX * 10).toFixed(1)}°` : '-'}
              </div>
              <div className="stat-label">Head Rotation</div>
            </div>
          </div>

          <h3 className="panel-title" style={{ marginTop: 24 }}>System Info</h3>
          <div className="sys-info">
            <div className="sys-row">
              <span>Status</span>
              <span className={`sys-status ${vtuber.isLoaded ? 'ok' : 'busy'}`}>
                {vtuber.isLoaded ? 'Online' : 'Initializing'}
              </span>
            </div>
            <div className="sys-row">
              <span>Engine</span>
              <span>MediaPipe WASM</span>
            </div>
            <div className="sys-row">
              <span>Resolution</span>
              <span>640×480</span>
            </div>
            <div className="sys-row">
              <span>Overlays</span>
              <span>{vtuber.overlays.length} active</span>
            </div>
            <div className="sys-row">
              <span>Hand Tracking</span>
              <span className={vtuber.handTracking ? 'text-accent' : 'text-muted'}>
                {vtuber.handTracking ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <h3 className="panel-title" style={{ marginTop: 24 }}>
            Contributors
            {!vtuber.isLoaded && (
              <span className="contributors-badge">GitHub</span>
            )}
          </h3>
          <ContributorsSection />

          <h3 className="panel-title" style={{ marginTop: 24 }}>Pose Values</h3>
          <div className="pose-bars">
            {vtuber.pose ? (
              <>
                <PoseBar label="Left Eye" value={vtuber.pose.eyeLHTemp} />
                <PoseBar label="Right Eye" value={vtuber.pose.eyeRHTemp} />
                <PoseBar label="Mouth" value={Math.min(vtuber.pose.mouthRatio, 1)} />
                <PoseBar label="Eye X" value={Math.abs(vtuber.pose.eyeXRatio) / 5} />
                <PoseBar label="Eye Y" value={Math.abs(vtuber.pose.eyeYRatio) / 5} />
              </>
            ) : (
              <p className="text-muted">Waiting for tracking data...</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function PoseBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="pose-bar">
      <div className="pose-bar-label">
        <span>{label}</span>
        <span>{(clamped * 100).toFixed(0)}%</span>
      </div>
      <div className="pose-bar-track">
        <div
          className="pose-bar-fill"
          style={{
            width: `${clamped * 100}%`,
            backgroundColor: clamped > 0.7 ? '#ff6b9d' : clamped > 0.4 ? '#ffb7c5' : 'rgba(255,183,197,0.4)',
          }}
        />
      </div>
    </div>
  );
}

export default App;
