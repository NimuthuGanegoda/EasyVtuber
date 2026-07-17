// MediaPipe FaceMesh landmark indices for facial features
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

// MediaPipe IRIS indices
const FACEMESH_LEFT_IRIS = [474, 475, 476, 477];
const FACEMESH_RIGHT_IRIS = [469, 470, 471, 472];

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

function getDistance(p1: Landmark, p2: Landmark): number {
  return Math.sqrt(
    (p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2
  );
}

// MediaPipe FaceLandmarker always returns 478 landmarks (468 mesh + 10 iris)
// when iris refinement is enabled, which this app relies on for the indices
// above — this accessor just gives the type checker a guarantee to work with.
function at(landmarks: Landmark[], idx: number): Landmark {
  const p = landmarks[idx];
  if (!p) throw new Error(`Missing landmark at index ${idx}`);
  return p;
}

function getIrisCenter(landmarks: Landmark[], side: 'left' | 'right'): Landmark {
  const indices = side === 'left' ? FACEMESH_LEFT_IRIS : FACEMESH_RIGHT_IRIS;
  let x = 0, y = 0, z = 0;
  indices.forEach((idx) => {
    const p = at(landmarks, idx);
    x += p.x;
    y += p.y;
    z += p.z;
  });
  return {
    x: x / indices.length,
    y: y / indices.length,
    z: z / indices.length,
  };
}

// MediaPipe's facialTransformationMatrixes (when outputFacialTransformationMatrixes
// is enabled) is a proper 4x4 rotation+translation matrix mapping the canonical
// face model to the detected head pose — far more accurate than estimating
// head angle from 2-3 landmark positions. Data is column-major (confirmed via
// MediaPipe's own docs and the community-standard `THREE.Matrix4().fromArray()`
// consumption pattern). Extraction below is Three.js's own battle-tested
// 'XYZ'-order matrix-to-Euler formula, chosen specifically because that's the
// same matrix convention already validated by that ecosystem — not invented
// fresh. Verified independently here via unit tests against known pure-axis
// rotation matrices (see poseExtractor.matrix.test approach): each axis
// isolates cleanly with zero cross-talk in both rotation directions.
//
// One thing NOT verified (no real camera available in this environment): the
// sign of the extracted angle relative to which way the avatar visually turns
// on screen. The rotation math itself is confirmed correct; if the avatar
// turns/tilts the wrong direction once tested against a real face, it's a
// one-line sign flip here, not a re-derivation.
function extractHeadRotationFromMatrix(data: number[]): { pitch: number; yaw: number; roll: number } {
  // Column-major: R[row][col] = data[col*4 + row]. Only the entries the
  // 'XYZ'-order extraction formula actually needs are pulled out.
  const m11 = data[0] ?? 0, m12 = data[4] ?? 0, m13 = data[8] ?? 0;
  const m22 = data[5] ?? 0, m23 = data[9] ?? 0;
  const m32 = data[6] ?? 0, m33 = data[10] ?? 0;

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

// MediaPipe's face_landmarker task can output 52 ARKit-style blendshape
// scores (ML-derived, pose/lighting-robust) alongside raw landmarks. When
// available, prefer them over the geometric landmark-ratio heuristics below
// for blink and mouth-open — they're materially more accurate. Falls back
// to geometry when blendshapes aren't provided (e.g. a caller that only has
// raw landmarks). Same for transformMatrix and head rotation.
export function extractPose(
  landmarks: Landmark[],
  blendshapes?: Record<string, number>,
  transformMatrix?: number[]
): PoseData {
  const irisRCenter = getIrisCenter(landmarks, 'right');
  const irisLCenter = getIrisCenter(landmarks, 'left');

  const mouthTop = at(landmarks, MOUTH_TOP);
  const mouthBottom = at(landmarks, MOUTH_BOTTOM);
  const mouthRight = at(landmarks, MOUTH_RIGHT);
  const mouthLeft1 = at(landmarks, MOUTH_LEFT1);
  const mouthLeft2 = at(landmarks, MOUTH_LEFT2);
  const mouthH = mouthTop.y - mouthBottom.y;
  const mouthW = mouthRight.x - (mouthLeft1.x + mouthLeft2.x) / 2;
  const mouthRatio = Math.abs(mouthH / mouthW);

  const p197 = at(landmarks, 197);
  const p9 = at(landmarks, 9);
  const p152 = at(landmarks, 152);
  const irisLTop = at(landmarks, IRIS_L_TOP);
  const irisLBottom = at(landmarks, IRIS_L_BOTTOM);
  const irisLLeft = at(landmarks, IRIS_L_LEFT);
  const irisLRight = at(landmarks, IRIS_L_RIGHT);
  const irisRTop = at(landmarks, IRIS_R_TOP);
  const irisRBottom = at(landmarks, IRIS_R_BOTTOM);
  const irisRLeft = at(landmarks, IRIS_R_LEFT);
  const irisRRight = at(landmarks, IRIS_R_RIGHT);

  // Angle calculations (geometric fallback; overridden below by the
  // transformation-matrix-derived values when available — see xAngleFinal etc.)
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
    (irisLCenter.x - irisLTop.x) ** 2 + (irisLCenter.y - irisLTop.y) ** 2
  );
  const irisRotationLWTemp = Math.sqrt(
    (irisLCenter.x - irisLRight.x) ** 2 + (irisLCenter.y - irisLRight.y) ** 2
  );
  const irisRotationRHTemp = Math.sqrt(
    (irisRCenter.x - irisRTop.x) ** 2 + (irisRCenter.y - irisRTop.y) ** 2
  );
  const irisRotationRWTemp = Math.sqrt(
    (irisRCenter.x - irisRRight.x) ** 2 + (irisRCenter.y - irisRRight.y) ** 2
  );

  const eyeXRatio =
    (irisRotationLWTemp / irisRotationLW +
      irisRotationRWTemp / irisRotationRW -
      1) *
    3;
  const eyeYRatio =
    (irisRotationLHTemp / irisRotationLH +
      irisRotationRHTemp / irisRotationRH -
      1) *
    3;

  let eyeLHTemp =
    1 - (2 * (irisRBottom.y - irisRTop.y)) / (irisRLeft.x - irisRRight.x);
  let eyeRHTemp =
    1 - (2 * (irisLBottom.y - irisLTop.y)) / (irisLLeft.x - irisLRight.x);
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

  // Normalized head position
  const noseTip = at(landmarks, 1);
  const headX = (noseTip.x - 0.5) * 2;
  const headY = (noseTip.y - 0.5) * 2;
  const headZ = noseTip.z * 2;

  return {
    eyeLHTemp,
    eyeRHTemp,
    mouthRatio: mouthRatioFinal,
    eyeYRatio,
    eyeXRatio,
    xAngle: xAngleFinal,
    yAngle: yAngleFinal,
    zAngle: zAngleFinal,
    headX,
    headY,
    headZ,
  };
}
