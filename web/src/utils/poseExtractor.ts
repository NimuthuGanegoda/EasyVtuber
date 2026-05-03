// Points from desktop/backend/utils/facial_points.py
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
const IRIS_R_LEFT = 33; // Fixed from facial_points.py (R_LEFT should be inner, R_RIGHT should be outer)
const IRIS_R_RIGHT = 155; 

// MediaPipe IRIS indices
const FACEMESH_LEFT_IRIS = [474, 475, 476, 477];
const FACEMESH_RIGHT_IRIS = [469, 470, 471, 472];

export interface Landmark {
    x: number;
    y: number;
    z: number;
}

function getDistance(p1: Landmark, p2: Landmark) {
    return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2 + (p1.z - p2.z) ** 2);
}

function getIrisCenter(landmarks: any[], side: 'left' | 'right') {
    const indices = side === 'left' ? FACEMESH_LEFT_IRIS : FACEMESH_RIGHT_IRIS;
    let x = 0, y = 0, z = 0;
    indices.forEach(idx => {
        x += landmarks[idx].x;
        y += landmarks[idx].y;
        z += landmarks[idx].z;
    });
    return { x: x / indices.length, y: y / indices.length, z: z / indices.length };
}

export function extractPose(landmarks: any[]) {
    const irisRCenter = getIrisCenter(landmarks, 'right');
    const irisLCenter = getIrisCenter(landmarks, 'left');

    const mouthH = landmarks[MOUTH_TOP].y - landmarks[MOUTH_BOTTOM].y;
    const mouthW = landmarks[MOUTH_RIGHT].x - (landmarks[MOUTH_LEFT1].x + landmarks[MOUTH_LEFT2].x) / 2;
    const mouthRatio = Math.abs(mouthH / mouthW);

    // Angle calculations (ported from Python atan2)
    const xAngle = Math.atan2(landmarks[197].y - landmarks[9].y, landmarks[197].z - landmarks[9].z);
    const yAngle = Math.atan2(landmarks[IRIS_L_TOP].z - landmarks[IRIS_R_TOP].z, landmarks[IRIS_L_TOP].x - landmarks[IRIS_R_TOP].x);
    const zAngle = Math.atan2(landmarks[9].y - landmarks[152].y, landmarks[9].x - landmarks[152].x);

    // Eye ratios
    const irisRotationLH = getDistance(landmarks[IRIS_L_TOP], landmarks[IRIS_L_BOTTOM]);
    const irisRotationLW = getDistance(landmarks[IRIS_L_RIGHT], landmarks[IRIS_L_LEFT]);
    const irisRotationRH = getDistance(landmarks[IRIS_R_TOP], landmarks[IRIS_R_BOTTOM]);
    const irisRotationRW = getDistance(landmarks[IRIS_R_RIGHT], landmarks[IRIS_R_LEFT]);

    const irisRotationLHTemp = Math.sqrt((irisLCenter.x - landmarks[IRIS_L_TOP].x) ** 2 + (irisLCenter.y - landmarks[IRIS_L_TOP].y) ** 2);
    const irisRotationLWTemp = Math.sqrt((irisLCenter.x - landmarks[IRIS_L_RIGHT].x) ** 2 + (irisLCenter.y - landmarks[IRIS_L_RIGHT].y) ** 2);
    const irisRotationRHTemp = Math.sqrt((irisRCenter.x - landmarks[IRIS_R_TOP].x) ** 2 + (irisRCenter.y - landmarks[IRIS_R_TOP].y) ** 2);
    const irisRotationRWTemp = Math.sqrt((irisRCenter.x - landmarks[IRIS_R_RIGHT].x) ** 2 + (irisRCenter.y - landmarks[IRIS_R_RIGHT].y) ** 2);

    const eyeXRatio = ((irisRotationLWTemp / irisRotationLW + irisRotationRWTemp / irisRotationRW) - 1) * 3;
    const eyeYRatio = ((irisRotationLHTemp / irisRotationLH + irisRotationRHTemp / irisRotationRH) - 1) * 3;

    const eyeLHTemp = 1 - 2 * (landmarks[IRIS_R_BOTTOM].y - landmarks[IRIS_R_TOP].y) / (landmarks[IRIS_R_LEFT].x - landmarks[IRIS_R_RIGHT].x);
    const eyeRHTemp = 1 - 2 * (landmarks[IRIS_L_BOTTOM].y - landmarks[IRIS_L_TOP].y) / (landmarks[IRIS_L_LEFT].x - landmarks[IRIS_L_RIGHT].x);

    return {
        eyeLHTemp,
        eyeRHTemp,
        mouthRatio,
        eyeYRatio,
        eyeXRatio,
        xAngle,
        yAngle,
        zAngle
    };
}
