// WebGL-accelerated character renderer.
// Draws the VTuber character using WebGL shaders for performance.
// Falls back to a no-op if WebGL is unavailable.

import { PoseData } from '../hooks/useVtuber';

// Character rendering constants (mirrored from App.tsx)
const CHAR_CENTER_X = 256;
const CHAR_CENTER_Y = 230;
const HEAD_RADIUS = 66;
const EYE_SPACING = 25;
const EYE_W = 15;
const EYE_H = 19;
const IRIS_RADIUS = 10;
const PUPIL_RADIUS = 4;
// Relative to head center (was 240 -- combined with the cy offset that put
// the mouth at canvas y~460, well below the body, not on the face).
const MOUTH_Y = 34;
const MOUTH_MAX_W = 20;

// ─── Vertex Shader ────────────────────────────────────────────────────────

const VS_SOURCE = `#version 100
attribute vec2 a_position;
uniform vec2 u_resolution;

void main() {
  // Convert from pixel coords to clip space (-1 to 1)
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y; // Flip Y
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

// ─── Fragment Shader (single-shader approach with draw-type branching) ────

const FS_SOURCE = `#version 100
precision mediump float;

// Must be highp to match the vertex shader's default uniform precision --
// mismatched precision qualifiers for the same uniform name across stages
// fails to link on some drivers (caught via SwiftShader).
uniform highp vec2 u_resolution;
uniform vec4 u_color;
uniform vec4 u_color2;       // Secondary color (for gradients / stroke)
uniform vec4 u_params;       // x: shapeType, y: radius/width, z: extras, w: rotation
uniform vec4 u_params2;      // x: cx, y: cy, z: rx, w: ry (ellipse radii, center offset)

// Shape types
#define SHAPE_CIRCLE      0.0
#define SHAPE_ELLIPSE     1.0
#define SHAPE_RECT        2.0
#define SHAPE_LINE        3.0
#define SHAPE_RING        4.0
#define SHAPE_RADIAL_GRAD 5.0
#define SHAPE_ARC         6.0
#define SHAPE_ELLIPSE_BG  7.0

void main() {
  // gl_FragCoord has WebGL's native bottom-left origin (Y increases upward),
  // but every cx/cy this shader receives is computed JS-side assuming
  // canvas/DOM convention (Y increases downward from the top) -- flip here,
  // once, rather than needing every caller to account for it.
  vec2 st = vec2(gl_FragCoord.x, u_resolution.y - gl_FragCoord.y);
  float shapeType = u_params.x;
  float radius = u_params.y;
  float cx = u_params2.x;
  float cy = u_params2.y;
  float rx = u_params2.z;
  float ry = u_params2.w;
  vec4 color = u_color;
  vec4 color2 = u_color2;

  // Center offset
  float dx = st.x - cx;
  float dy = st.y - cy;

  // Rotation
  float angle = u_params.w;
  float cosA = cos(angle);
  float sinA = sin(angle);
  float rdx = dx * cosA - dy * sinA;
  float rdy = dx * sinA + dy * cosA;

  if (shapeType == SHAPE_CIRCLE) {
    // Filled circle
    float d = length(vec2(rdx, rdy)) - radius;
    float alpha = 1.0 - smoothstep(0.0, 1.5, d);
    gl_FragColor = vec4(color.rgb, color.a * alpha);

  } else if (shapeType == SHAPE_ELLIPSE) {
    // Filled ellipse. d is in normalized ellipse-space (divided by rx/ry),
    // so a constant smoothstep width here would scale with the ellipse's
    // size instead of staying a fixed ~1.5px edge -- convert the desired
    // pixel-space edge width into normalized units using the smaller axis.
    float d = length(vec2(rdx / rx, rdy / ry)) - 1.0;
    float edgePx = 1.5 / max(min(rx, ry), 1.0);
    float alpha = 1.0 - smoothstep(0.0, edgePx, d);
    gl_FragColor = vec4(color.rgb, color.a * alpha);

  } else if (shapeType == SHAPE_ELLIPSE_BG) {
    // Ellipse with background gradient (body shape) -- same normalized-space
    // edge-width fix as SHAPE_ELLIPSE above.
    float d = length(vec2(rdx / rx, rdy / ry)) - 1.0;
    float edgePx = 1.5 / max(min(rx, ry), 1.0);
    float alpha = 1.0 - smoothstep(0.0, edgePx, d);
    float gradFactor = 0.5 + 0.5 * (dy / (ry * 1.2));
    vec3 mixed = mix(color.rgb, color2.rgb, gradFactor);
    gl_FragColor = vec4(mixed, color.a * alpha);

  } else if (shapeType == SHAPE_RECT) {
    // Filled rectangle
    float halfW = rx * 0.5;
    float halfH = ry * 0.5;
    float d = max(abs(rdx) - halfW, abs(rdy) - halfH);
    float alpha = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(color.rgb, color.a * alpha);

  } else if (shapeType == SHAPE_LINE) {
    // Line segment with thickness (rounded ends)
    float len = u_params.z;        // line length
    float thickness = radius;
    vec2 dir = vec2(cosA, sinA);  // direction vector
    vec2 start = vec2(cx - dir.x * len * 0.5, cy - dir.y * len * 0.5);
    vec2 end = vec2(cx + dir.x * len * 0.5, cy + dir.y * len * 0.5);

    // Distance to line segment
    vec2 seg = end - start;
    vec2 point = st - start;
    float t = clamp(dot(point, seg) / dot(seg, seg), 0.0, 1.0);
    vec2 closest = start + seg * t;
    float d = length(st - closest) - thickness * 0.5;

    float alpha = 1.0 - smoothstep(0.0, 1.0, d);
    gl_FragColor = vec4(color.rgb, color.a * alpha);

  } else if (shapeType == SHAPE_RING) {
    // Ring (stroked circle)
    float d = abs(length(vec2(rdx, rdy)) - radius);
    float halfStroke = u_params.z * 0.5;
    float alpha = 1.0 - smoothstep(0.0, 1.0, d - halfStroke);
    gl_FragColor = vec4(color.rgb, color.a * alpha);

  } else if (shapeType == SHAPE_RADIAL_GRAD) {
    // Radial gradient (blush)
    float d = length(vec2(rdx / rx, rdy / ry));
    float t = clamp(d, 0.0, 1.0);
    vec3 mixed = mix(color.rgb, color2.rgb, t);
    float alpha = color.a * (1.0 - smoothstep(0.0, 1.0, t));
    gl_FragColor = vec4(mixed, alpha);

  } else if (shapeType == SHAPE_ARC) {
    // Arc (hair - top half of circle filled)
    float d = length(vec2(rdx, rdy)) - radius;
    float alpha = 1.0 - smoothstep(0.0, 1.5, d);
    // Only show top half (y < 0 in local space)
    if (rdy > 0.0) alpha = 0.0;
    gl_FragColor = vec4(color.rgb, color.a * alpha);
  }
}
`;

// ─── Shape command ────────────────────────────────────────────────────────

interface ShapeCmd {
  type: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: [number, number, number, number];
  color2?: [number, number, number, number];
  radius: number;
  angle: number;
  extras: number;
}

// ─── WebGL Renderer ───────────────────────────────────────────────────────

export class WebGLCharacterRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private posLoc = -1;
  private resLoc: WebGLUniformLocation | null = null;
  private colorLoc: WebGLUniformLocation | null = null;
  private color2Loc: WebGLUniformLocation | null = null;
  private paramsLoc: WebGLUniformLocation | null = null;
  private params2Loc: WebGLUniformLocation | null = null;
  private ready = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.init();
  }

  private init() {
    try {
      const gl = this.canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        antialias: true,
      });
      if (!gl) {
        console.warn('WebGL not available, falling back to Canvas 2D');
        return;
      }
      this.gl = gl;

      // Compile shaders
      const vs = this.compileShader(gl.VERTEX_SHADER, VS_SOURCE);
      const fs = this.compileShader(gl.FRAGMENT_SHADER, FS_SOURCE);
      if (!vs || !fs) return;

      const program = gl.createProgram();
      if (!program) return;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.warn('WebGL program link failed:', gl.getProgramInfoLog(program));
        return;
      }
      this.program = program;

      // Get locations
      this.posLoc = gl.getAttribLocation(program, 'a_position');
      this.resLoc = gl.getUniformLocation(program, 'u_resolution');
      this.colorLoc = gl.getUniformLocation(program, 'u_color');
      this.color2Loc = gl.getUniformLocation(program, 'u_color2');
      this.paramsLoc = gl.getUniformLocation(program, 'u_params');
      this.params2Loc = gl.getUniformLocation(program, 'u_params2');

      // Set up geometry (full-screen quad)
      this.positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      const vertices = new Float32Array([
        0, 0,
        this.canvas.width, 0,
        0, this.canvas.height,
        this.canvas.width, this.canvas.height,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);

      this.ready = true;
    } catch (e) {
      console.warn('WebGL initialization failed:', e);
    }
  }

  private compileShader(type: number, source: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private drawShape(cmd: ShapeCmd) {
    const gl = this.gl;
    if (!gl || !this.program) return;

    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform2f(this.resLoc, this.canvas.width, this.canvas.height);

    const c = cmd.color;
    gl.uniform4f(this.colorLoc, c[0], c[1], c[2], c[3]);

    const c2 = cmd.color2 || [0, 0, 0, 0];
    gl.uniform4f(this.color2Loc, c2[0], c2[1], c2[2], c2[3]);

    gl.uniform4f(this.paramsLoc, cmd.type, cmd.radius, cmd.extras, cmd.angle);
    gl.uniform4f(this.params2Loc, cmd.cx, cmd.cy, cmd.rx, cmd.ry);

    // Draw quad
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  clear() {
    const gl = this.gl;
    if (!gl) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  render(pose: PoseData | null) {
    if (!this.ready || !this.gl) return false;

    this.clear();

    const shapes = this.buildShapes(pose);
    for (const cmd of shapes) {
      this.drawShape(cmd);
    }

    return true;
  }

  private buildShapes(pose: PoseData | null): ShapeCmd[] {
    const shapes: ShapeCmd[] = [];
    const W = this.canvas.width;
    const H = this.canvas.height;

    const headTilt = pose ? (pose.xAngle || 0) * 40 : 0;
    const headTurn = pose ? (pose.yAngle || 0) * 30 : 0;
    const headRoll = pose ? (pose.zAngle || 0) * 6 * (Math.PI / 180) : 0;

    const cx = CHAR_CENTER_X + headTurn;
    const cy = CHAR_CENTER_Y + headTilt;

    const skin = (a: number): [number, number, number, number] => [1, 0.89, 0.84, a];
    const skinShade = (a: number): [number, number, number, number] => [1, 0.796, 0.722, a];
    const hair = (a: number): [number, number, number, number] => [1, 0.361, 0.581, a];
    const hairDark = (a: number): [number, number, number, number] => [0.839, 0.239, 0.459, a];
    const hairLight = (a: number): [number, number, number, number] => [1, 0.616, 0.753, a];
    const iris = (a: number): [number, number, number, number] => [0.639, 0.31, 0.839, a];
    const irisDark = (a: number): [number, number, number, number] => [0.42, 0.165, 0.58, a];
    const pupil = (a: number): [number, number, number, number] => [0.165, 0.063, 0.188, a];
    const white = (a: number): [number, number, number, number] => [1, 0.973, 0.984, a];
    const mouthCol = (a: number): [number, number, number, number] => [0.761, 0.247, 0.42, a];
    const mouthInner = (a: number): [number, number, number, number] => [0.478, 0.122, 0.239, a];

    // ── Body ──
    shapes.push({
      type: 7, // SHAPE_ELLIPSE_BG
      cx, cy: cy + HEAD_RADIUS * 2.4,
      rx: HEAD_RADIUS * 1.25, ry: HEAD_RADIUS * 1.6,
      color: hairLight(0.85),
      color2: hair(0.75),
      radius: 0, angle: 0, extras: 0,
    });

    // ── Hair tails (behind everything, flow down past shoulders) ──
    for (const side of [-1, 1]) {
      shapes.push({
        type: 1, // SHAPE_ELLIPSE
        cx: cx + side * HEAD_RADIUS * 0.9, cy: cy + HEAD_RADIUS * 1.2,
        rx: HEAD_RADIUS * 0.32, ry: HEAD_RADIUS * 1.15,
        color: hairDark(0.95),
        radius: 0, angle: side * 0.12 + headRoll, extras: 0,
      });
    }

    // ── Back hair mass ──
    shapes.push({
      type: 1, // SHAPE_ELLIPSE
      cx, cy: cy + HEAD_RADIUS * 0.15,
      rx: HEAD_RADIUS * 1.0, ry: HEAD_RADIUS * 1.35,
      color: hairDark(0.95),
      radius: 0, angle: headRoll, extras: 0,
    });

    // ── Neck ──
    shapes.push({
      type: 2, // SHAPE_RECT
      cx, cy: cy + HEAD_RADIUS * 1.0,
      rx: 26, ry: HEAD_RADIUS * 0.55,
      color: skinShade(0.9),
      radius: 0, angle: headRoll, extras: 0,
    });

    // ── Head / face ──
    shapes.push({
      type: 7, // SHAPE_ELLIPSE_BG
      cx, cy,
      rx: HEAD_RADIUS * 0.92, ry: HEAD_RADIUS * 1.05,
      color: skin(0.98),
      color2: skinShade(0.55),
      radius: 0, angle: headRoll, extras: 0,
    });

    // ── Bangs (front hair over the forehead) ──
    shapes.push({
      type: 6, // SHAPE_ARC (top-half only)
      cx, cy: cy - HEAD_RADIUS * 0.35,
      rx: 0, ry: 0,
      color: hairLight(0.95),
      radius: HEAD_RADIUS * 0.98, angle: headRoll, extras: 0,
    });

    // ── Eyes ──
    const eyeOpenL = pose ? Math.max(0.06, 1 - pose.eyeLHTemp) : 1;
    const eyeOpenR = pose ? Math.max(0.06, 1 - pose.eyeRHTemp) : 1;
    const eyeXOffset = pose ? Math.max(-4, Math.min(4, pose.eyeXRatio * 3)) : 0;
    const eyeYOffset = pose ? Math.max(-3, Math.min(3, pose.eyeYRatio * 3)) : 0;

    for (const side of [-1, 1]) {
      const ex = side * EYE_SPACING;
      const ey = cy - HEAD_RADIUS * 0.12;
      const open = side === -1 ? eyeOpenL : eyeOpenR;
      const eh = EYE_H * open;

      // Eye outline (a slightly larger dark ellipse painted behind the
      // white fill below — RING is circular-only in this shader and would
      // mismatch the eye's actual ellipse shape, especially mid-blink when
      // eh shrinks well below EYE_W).
      shapes.push({
        type: 1, // SHAPE_ELLIPSE
        cx: cx + ex, cy: ey,
        rx: EYE_W + 2, ry: eh + 2,
        color: hairDark(0.6),
        radius: 0, angle: 0, extras: 0,
      });

      // White of eye
      shapes.push({
        type: 1, // SHAPE_ELLIPSE
        cx: cx + ex, cy: ey,
        rx: EYE_W, ry: eh,
        color: white(0.98),
        radius: 0, angle: 0, extras: 0,
      });

      if (open > 0.15) {
        // Iris (radial gradient for depth)
        shapes.push({
          type: 5, // SHAPE_RADIAL_GRAD
          cx: cx + ex + eyeXOffset, cy: ey + eyeYOffset,
          rx: IRIS_RADIUS, ry: IRIS_RADIUS,
          color: iris(1), color2: irisDark(1),
          radius: 0, angle: 0, extras: 0,
        });
        // Pupil
        shapes.push({
          type: 0, // SHAPE_CIRCLE
          cx: cx + ex + eyeXOffset, cy: ey + eyeYOffset,
          rx: 0, ry: 0,
          color: pupil(1),
          radius: PUPIL_RADIUS, angle: 0, extras: 0,
        });
        // Highlights — the biggest visual cue for an anime-style eye
        shapes.push({
          type: 0, // SHAPE_CIRCLE
          cx: cx + ex + eyeXOffset - 4, cy: ey + eyeYOffset - 5,
          rx: 0, ry: 0,
          color: white(0.95),
          radius: 3, angle: 0, extras: 0,
        });
        shapes.push({
          type: 0, // SHAPE_CIRCLE
          cx: cx + ex + eyeXOffset + 4, cy: ey + eyeYOffset + 4,
          rx: 0, ry: 0,
          color: white(0.8),
          radius: 1.3, angle: 0, extras: 0,
        });
      }
    }

    // ── Eyebrows ──
    for (const side of [-1, 1]) {
      const lx = cx + side * (EYE_SPACING - 14);
      const ly = cy - HEAD_RADIUS * 0.42;
      const rx = cx + side * (EYE_SPACING + 13);
      const ry = cy - HEAD_RADIUS * 0.4;
      const midX = (lx + rx) / 2;
      const midY = (ly + ry) / 2;
      const len = Math.abs(rx - lx);
      const angle = Math.atan2(ry - ly, rx - lx);

      shapes.push({
        type: 3, // SHAPE_LINE
        cx: midX, cy: midY,
        rx: 0, ry: 0,
        color: hairDark(0.9),
        radius: 3, angle, extras: len,
      });
    }

    // ── Mouth ──
    const mouthOpen = pose ? Math.min(pose.mouthRatio * 26, 22) : 0;
    if (mouthOpen < 2) {
      shapes.push({
        type: 3, // SHAPE_LINE
        cx, cy: cy + MOUTH_Y,
        rx: 0, ry: 0,
        color: mouthCol(0.85),
        radius: 1.8, angle: 0, extras: MOUTH_MAX_W * 0.85,
      });
    } else {
      const my = cy + MOUTH_Y + mouthOpen * 0.3;
      const mrx = MOUTH_MAX_W * 0.62, mry = mouthOpen * 0.55;
      // Outline ellipse behind the fill (RING is circular-only in this
      // shader and would mismatch the mouth's actual ellipse aspect ratio).
      shapes.push({
        type: 1, // SHAPE_ELLIPSE
        cx, cy: my,
        rx: mrx + 1.5, ry: mry + 1.5,
        color: mouthCol(0.85),
        radius: 0, angle: 0, extras: 0,
      });
      shapes.push({
        type: 1, // SHAPE_ELLIPSE
        cx, cy: my,
        rx: mrx, ry: mry,
        color: mouthInner(0.95),
        radius: 0, angle: 0, extras: 0,
      });
    }

    // ── Side locks (in front, framing the face — kept low so they don't
    // poke above the head silhouette like ears) ──
    for (const side of [-1, 1]) {
      shapes.push({
        type: 1, // SHAPE_ELLIPSE
        cx: cx + side * HEAD_RADIUS * 0.85, cy: cy + HEAD_RADIUS * 0.55,
        rx: HEAD_RADIUS * 0.18, ry: HEAD_RADIUS * 0.55,
        color: hair(0.95),
        radius: 0, angle: side * 0.06 + headRoll, extras: 0,
      });
    }

    // ── Blush ──
    for (const side of [-1, 1]) {
      shapes.push({
        type: 5, // SHAPE_RADIAL_GRAD
        cx: cx + side * HEAD_RADIUS * 0.55, cy: cy + HEAD_RADIUS * 0.35,
        rx: 13, ry: 13,
        color: hair(0.35),
        color2: [1, 0.361, 0.581, 0],
        radius: 0, angle: 0, extras: 0,
      });
    }

    return shapes;
  }

  resize(w: number, h: number) {
    const gl = this.gl;
    if (!gl) return;
    this.canvas.width = w;
    this.canvas.height = h;
    gl.viewport(0, 0, w, h);

    // Update quad vertices
    if (this.positionBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
      const vertices = new Float32Array([0, 0, w, 0, 0, h, w, h]);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    }
  }

  isReady(): boolean {
    return this.ready;
  }

  destroy() {
    const gl = this.gl;
    if (!gl) return;
    if (this.program) gl.deleteProgram(this.program);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    this.ready = false;
  }
}

// Convenience function to create and render in one step
export function createWebGLRenderer(canvas: HTMLCanvasElement): WebGLCharacterRenderer | null {
  try {
    return new WebGLCharacterRenderer(canvas);
  } catch {
    return null;
  }
}
