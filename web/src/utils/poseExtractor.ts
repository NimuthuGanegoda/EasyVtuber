// MediaPipe FaceMesh landmark indices for facial features.
//
// Two landmark populations are in play:
//  - the 468-point base face mesh, always present;
//  - the 10 iris points (indices 468-477), only present when the model is run
//    with iris refinement.
// Everything below must therefore work with either 468 or 478 points. Earlier
// versions indexed the iris unconditionally and threw on a 468-point result,
// which (combined with silent catch blocks at both call sites) froze the
// avatar with no diagnostic at all. See POSE_MIN_LANDMARKS.

const MOUTH_TOP = 13;
const MOUTH_BOTTOM = 14;
const MOUTH_RIGHT = 78;
const MOUTH_LEFT1 = 409;
const MOUTH_LEFT2 = 375;

const IRIS_L_TOP = 386;
const IRIS_L_BOTTOM = 374;
const IRIS_L_LEFT = 263;
const IRIS_L_RIGHT = 382;

const IRIS_R_TOP = 159;
const IRIS_R_BOTTOM = 145;
const IRIS_R_LEFT = 155;
const IRIS_R_RIGHT = 33;

// MediaPipe iris ring indices (only present in 478-point output)
const FACEMESH_LEFT_IRIS = [474, 475, 476, 477];
const FACEMESH_RIGHT_IRIS = [469, 470, 471, 472];

/** Face contour points surrounding each eye — used to locate the iris when the
 * refinement points are absent, and as the outer bounds of the eye aperture. */
const LEFT_EYE_CONTOUR = [IRIS_L_TOP, IRIS_L_BOTTOM, IRIS_L_LEFT, IRIS_L_RIGHT];
const RIGHT_EYE_CONTOUR = [IRIS_R_TOP, IRIS_R_BOTTOM, IRIS_R_LEFT, IRIS_R_RIGHT];

/** Landmarks required for the geometry below to mean anything (the 468-point mesh). */
export const POSE_MIN_LANDMARKS = 468;
/** Index at which the iris refinement points begin. */
export const IRIS_LANDMARK_INDEX = 468;

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface PoseData {
  eyeLHTemp: number;
  eyeRHTemp: number;
  mouthRatio: number;
  eyeYRatio: number;
  eyeXRatio: number;
  xAngle: number;
  yAngle: number;
  zAngle: number;
  headX: number;
  headY: number;
  headZ: number;
}

/**
 * Thrown when the landmark array cannot produce a pose at all (too few points,
 * non-finite values). Callers are expected to surface this to the user rather
 * than swallow it — a frozen avatar with a working-looking UI is the worst
 * possible failure mode.
 */
export class PoseExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PoseExtractionError';
  }
}

const FALLBACK_LANDMARK: Landmark = { x: 0.5, y: 0.5, z: 0 };

function getDistance(p1: Landmark, p2: Landmark): number {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
}

/** True when MediaPipe returned the iris refinement points. */
export function hasIrisLandmarks(landmarks: Landmark[]): boolean {
  return landmarks.length > IRIS_LANDMARK_INDEX;
}

function pick(landmarks: Landmark[], idx: number): Landmark {
  return landmarks[idx] ?? FALLBACK_LANDMARK;
}

/** Division with a fallback, so a degenerate frame can't poison the whole pose with NaN. */
function safeRatio(numerator: number, denominator: number, fallback = 0): number {
  if (denominator === 0) return fallback;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : fallback;
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function centroid(landmarks: Landmark[], indices: number[]): Landmark {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const idx of indices) {
    const p = pick(landmarks, idx);
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const n = indices.length || 1;
  return { x: x / n, y: y / n, z: z / n };
}

function getIrisCenter(landmarks: Landmark[], side: 'left' | 'right'): Landmark {
  const ring = side === 'left' ? FACEMESH_LEFT_IRIS : FACEMESH_RIGHT_IRIS;
  if (hasIrisLandmarks(landmarks)) {
    return centroid(landmarks, ring);
  }
  // No iris points: the eye contour's own centroid is the best available
  // approximation, and keeps gaze tracking roughly working instead of throwing.
  return centroid(landmarks, side === 'left' ? LEFT_EYE_CONTOUR : RIGHT_EYE_CONTOUR);
}

// MediaPipe's facialTransformationMatrixes (when outputFacialTransformationMatrixes
// is enabled) is a proper 4x4 rotation+translation matrix mapping the canonical
// face model to the detected head pose — far more accurate than estimating
// head angle from 2-3 landmark positions. Data is column-major (confirmed via
// MediaPipe's own docs and the community-standard `THREE.Matrix4().fromArray()`
// consumption pattern). Extraction below is Three.js's own battle-tested
// 'XYZ'-order matrix-to-Euler formula, chosen specifically because that's the
// same matrix convention already validated by that ecosystem — not invented
// fresh.
//
// One thing NOT verified against a real camera: the sign of the extracted angle
// relative to which way the avatar visually turns on screen. The rotation math
// itself is confirmed correct (see poseExtractor.test.ts, which checks each
// axis isolates cleanly against known pure-axis rotation matrices); if the
// avatar turns/tilts the wrong direction in practice, it's a one-line sign flip
// here, not a re-derivation.
export function extractHeadRotationFromMatrix(data: number[]): {
  pitch: number;
  yaw: number;
  roll: number;
} {
  // Column-major: R[row][col] = data[col*4 + row]. Only the entries the
  // 'XYZ'-order extraction formula actually needs are pulled out.
  const m11 = data[0] ?? 0;
  const m12 = data[4] ?? 0;
  const m13 = data[8] ?? 0;
  const m22 = data[5] ?? 0;
  const m23 = data[9] ?? 0;
  const m32 = data[6] ?? 0;
  const m33 = data[10] ?? 0;

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const yaw = Math.asin(clamp(m13, -1, 1));
  let pitch: number;
  let roll: number;
  if (Math.abs(m13) < 0.9999999) {
    pitch = Math.atan2(-m23, m33);
    roll = Math.atan2(-m12, m11);
  } else {
    // Gimbal lock (looking almost straight up/down): roll can't be recovered.
    pitch = Math.atan2(m32, m22);
    roll = 0;
  }
  return { pitch, yaw, roll };
}

/**
 * MediaPipe's face_landmarker task can output 52 ARKit-style blendshape
 * scores (ML-derived, pose/lighting-robust) alongside raw landmarks. When
 * available, prefer them over the geometric landmark-ratio heuristics below
 * for blink and mouth-open — they're materially more accurate. Falls back
 * to geometry when blendshapes aren't provided (e.g. a caller that only has
 * raw landmarks). Same for transformMatrix and head rotation.
 *
 * `landmarks` should be `result.faceLandmarks[0]`.
 *
 * @throws PoseExtractionError if the frame cannot produce a pose.
 */
export function extractPose(
  landmarks: Landmark[],
  blendshapes?: Record<string, number>,
  transformMatrix?: number[],
): PoseData {
  if (!landmarks || landmarks.length < POSE_MIN_LANDMARKS) {
    throw new PoseExtractionError(
      `Need at least ${POSE_MIN_LANDMARKS} face landmarks, got ${landmarks?.length ?? 0}. ` +
        'MediaPipe returned a partial/empty face mesh (no face detected, or the model is ' +
        'running without the full mesh).',
    );
  }

  const irisRCenter = getIrisCenter(landmarks, 'right');
  const irisLCenter = getIrisCenter(landmarks, 'left');

  const mouthTop = pick(landmarks, MOUTH_TOP);
  const mouthBottom = pick(landmarks, MOUTH_BOTTOM);
  const mouthRight = pick(landmarks, MOUTH_RIGHT);
  const mouthLeft1 = pick(landmarks, MOUTH_LEFT1);
  const mouthLeft2 = pick(landmarks, MOUTH_LEFT2);
  const mouthH = mouthTop.y - mouthBottom.y;
  const mouthW = mouthRight.x - (mouthLeft1.x + mouthLeft2.x) / 2;
  const mouthRatio = Math.abs(safeRatio(mouthH, mouthW));

  const p197 = pick(landmarks, 197);
  const p9 = pick(landmarks, 9);
  const p152 = pick(landmarks, 152);
  const irisLTop = pick(landmarks, IRIS_L_TOP);
  const irisLBottom = pick(landmarks, IRIS_L_BOTTOM);
  const irisLLeft = pick(landmarks, IRIS_L_LEFT);
  const irisLRight = pick(landmarks, IRIS_L_RIGHT);
  const irisRTop = pick(landmarks, IRIS_R_TOP);
  const irisRBottom = pick(landmarks, IRIS_R_BOTTOM);
  const irisRLeft = pick(landmarks, IRIS_R_LEFT);
  const irisRRight = pick(landmarks, IRIS_R_RIGHT);

  // Angle calculations (geometric fallback; overridden below by the
  // transformation-matrix-derived values when available)
  const xAngle = Math.atan2(p197.y - p9.y, p197.z - p9.z);
  const yAngle = Math.atan2(irisLTop.z - irisRTop.z, irisLTop.x - irisRTop.x);
  const zAngle = Math.atan2(p9.y - p152.y, p9.x - p152.x);

  let xAngleFinal = xAngle;
  let yAngleFinal = yAngle;
  let zAngleFinal = zAngle;
  if (transformMatrix && transformMatrix.length >= 11) {
    const { pitch, yaw, roll } = extractHeadRotationFromMatrix(transformMatrix);
    xAngleFinal = pitch;
    yAngleFinal = yaw;
    zAngleFinal = roll;
  }

  // Eye ratios
  const irisRotationLH = getDistance(irisLTop, irisLBottom);
  const irisRotationLW = getDistance(irisLRight, irisLLeft);
  const irisRotationRH = getDistance(irisRTop, irisRBottom);
  const irisRotationRW = getDistance(irisRRight, irisRLeft);

  const irisRotationLHTemp = Math.sqrt(
    (irisLCenter.x - irisLTop.x) ** 2 + (irisLCenter.y - irisLTop.y) ** 2,
  );
  const irisRotationLWTemp = Math.sqrt(
    (irisLCenter.x - irisLRight.x) ** 2 + (irisLCenter.y - irisLRight.y) ** 2,
  );
  const irisRotationRHTemp = Math.sqrt(
    (irisRCenter.x - irisRTop.x) ** 2 + (irisRCenter.y - irisRTop.y) ** 2,
  );
  const irisRotationRWTemp = Math.sqrt(
    (irisRCenter.x - irisRRight.x) ** 2 + (irisRCenter.y - irisRRight.y) ** 2,
  );

  const eyeXRatio =
    (safeRatio(irisRotationLWTemp, irisRotationLW) +
      safeRatio(irisRotationRWTemp, irisRotationRW) -
      1) *
    3;
  const eyeYRatio =
    (safeRatio(irisRotationLHTemp, irisRotationLH) +
      safeRatio(irisRotationRHTemp, irisRotationRH) -
      1) *
    3;

  let eyeLHTemp = 1 - 2 * safeRatio(irisRBottom.y - irisRTop.y, irisRLeft.x - irisRRight.x);
  let eyeRHTemp = 1 - 2 * safeRatio(irisLBottom.y - irisLTop.y, irisLLeft.x - irisLRight.x);
  let mouthRatioFinal = mouthRatio;

  if (blendshapes) {
    // eyeBlinkLeft/Right blendshapes are already 0=open..1=closed, same
    // direction as eyeLHTemp/eyeRHTemp — and eyeLHTemp maps to the subject's
    // *right* eye (see IRIS_R_* above), matching ARKit's subject-relative
    // naming, so eyeBlinkRight -> eyeLHTemp is the correct pairing, not a bug.
    const blinkRight = blendshapes['eyeBlinkRight'];
    const blinkLeft = blendshapes['eyeBlinkLeft'];
    if (blinkRight !== undefined) eyeLHTemp = blinkRight;
    if (blinkLeft !== undefined) eyeRHTemp = blinkLeft;

    const jawOpen = blendshapes['jawOpen'];
    if (jawOpen !== undefined) mouthRatioFinal = jawOpen;
  }

  // Clamp blink/mouth to their meaningful range: the geometric estimates are
  // unbounded and feed straight into ellipse heights, where a negative value
  // or one far above 1 produces visibly broken eyes.
  eyeLHTemp = Math.min(1, Math.max(0, finite(eyeLHTemp)));
  eyeRHTemp = Math.min(1, Math.max(0, finite(eyeRHTemp)));
  mouthRatioFinal = Math.min(1, Math.max(0, finite(mouthRatioFinal)));

  // Normalized head position
  const noseTip = pick(landmarks, 1);
  const headX = (noseTip.x - 0.5) * 2;
  const headY = (noseTip.y - 0.5) * 2;
  const headZ = noseTip.z * 2;

  return {
    eyeLHTemp,
    eyeRHTemp,
    mouthRatio: mouthRatioFinal,
    eyeYRatio: finite(eyeYRatio),
    eyeXRatio: finite(eyeXRatio),
    xAngle: finite(xAngleFinal),
    yAngle: finite(yAngleFinal),
    zAngle: finite(zAngleFinal),
    headX: finite(headX),
    headY: finite(headY),
    headZ: finite(headZ),
  };
}
