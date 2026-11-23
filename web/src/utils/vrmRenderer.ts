// Real 3D character rendering via a VRM (rigged anime avatar) model, driven by
// Kalidokit's face solver + natural neck/spine follow, 3-point studio lighting,
// interactive stage camera controls, eye gaze lookAt, microphone lip-sync,
// auto-blink, idle breathing, and full VRM emotion expressions.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Face } from 'kalidokit';
import type {
  ExpressionState,
  StageCameraConfig,
  StageLightingConfig,
  TrackingTuning,
} from '../types';
import type { Landmark } from './poseExtractor';
import { DEFAULT_TRACKING_TUNING, sampleAutoBlink, type AutoBlinkState } from './trackingFilters';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

interface SmoothedFace {
  blinkL: number;
  blinkR: number;
  aa: number;
  ih: number;
  ou: number;
  ee: number;
  oh: number;
  headX: number;
  headY: number;
  headZ: number;
  pupilX: number;
  pupilY: number;
}

interface VrmHeadCalibration {
  x: number;
  y: number;
  z: number;
}

export class VRMCharacterRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private vrm: VRM | null = null;
  private loading = false;
  private ready = false;
  private clock: THREE.Clock;
  private elapsedSec = 0;

  private keyLight: THREE.DirectionalLight;
  private rimLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private lookAtTarget = new THREE.Object3D();

  // Baseline framed camera parameters computed from model bounding box
  private baseCenter = new THREE.Vector3(0, 1.38, 0);
  private baseDistance = 1.1;
  private baseFrameHeight = 0.55;
  private cameraConfig: StageCameraConfig = { zoom: 1, offsetX: 0, offsetY: 0, orbitYaw: 0 };

  private lastRawHead: VrmHeadCalibration = { x: 0, y: 0, z: 0 };
  private headCalibration: VrmHeadCalibration | null = null;
  private blinkState: AutoBlinkState = { nextBlinkAtMs: 0, blinkStartMs: null };

  private smoothed: SmoothedFace = {
    blinkL: 0,
    blinkR: 0,
    aa: 0,
    ih: 0,
    ou: 0,
    ee: 0,
    oh: 0,
    headX: 0,
    headY: 0,
    headZ: 0,
    pupilX: 0,
    pupilY: 0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(22, 1, 0.05, 50);
    this.camera.position.set(0, 1.42, 1.1);
    this.camera.lookAt(0, 1.4, 0);
    this.clock = new THREE.Clock();

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: true,
      });
      this.renderer.setSize(canvas.width, canvas.height, false);
      this.renderer.setPixelRatio(1);
    } catch (e) {
      console.warn('VRM: WebGL renderer init failed, falling back', e);
      this.renderer = null;
    }

    // 3-point studio lighting (Key + Rim + Ambient)
    this.keyLight = new THREE.DirectionalLight(0xfff5ef, 1.3);
    this.keyLight.position.set(0.7, 1.4, 1.4);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.DirectionalLight(0xf472b6, 0.75);
    this.rimLight.position.set(-1.1, 1.6, -1.2);
    this.scene.add(this.rimLight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(this.ambientLight);

    this.lookAtTarget.position.set(0, 1.4, 2);
    this.scene.add(this.lookAtTarget);
  }

  isReady(): boolean {
    return this.ready;
  }

  isLoading(): boolean {
    return this.loading;
  }

  calibrateHead(): void {
    this.headCalibration = { ...this.lastRawHead };
  }

  resetCalibration(): void {
    this.headCalibration = null;
  }

  setCameraConfig(config: StageCameraConfig): void {
    this.cameraConfig = { ...config };
    this.applyCameraTransform();
  }

  setLighting(config: StageLightingConfig): void {
    this.keyLight.intensity = clamp(config.keyIntensity, 0, 3);
    this.keyLight.color.set(config.keyColor);
    this.rimLight.intensity = clamp(config.rimIntensity, 0, 3);
    this.rimLight.color.set(config.rimColor);
    this.ambientLight.intensity = clamp(config.ambientIntensity, 0, 2);
  }

  unloadModel(): void {
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    this.ready = false;
    this.headCalibration = null;
    this.smoothed = {
      blinkL: 0,
      blinkR: 0,
      aa: 0,
      ih: 0,
      ou: 0,
      ee: 0,
      oh: 0,
      headX: 0,
      headY: 0,
      headZ: 0,
      pupilX: 0,
      pupilY: 0,
    };
  }

  async loadModel(url: string): Promise<boolean> {
    if (!this.renderer) return false;
    this.loading = true;
    try {
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));
      const gltf = await loader.loadAsync(url);
      const vrm = gltf.userData.vrm as VRM | undefined;
      if (!vrm) throw new Error('Loaded file has no VRM extension data');

      this.unloadModel();
      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      if (vrm.meta && 'metaVersion' in vrm.meta && vrm.meta.metaVersion === '0') {
        VRMUtils.rotateVRM0(vrm);
      }

      if (vrm.lookAt) {
        vrm.lookAt.target = this.lookAtTarget;
      }

      this.scene.add(vrm.scene);
      this.vrm = vrm;
      this.frameCamera();
      this.ready = true;
      return true;
    } catch (e) {
      console.warn('VRM: failed to load model:', e);
      return false;
    } finally {
      this.loading = false;
    }
  }

  private frameCamera(): void {
    const vrm = this.vrm;
    if (!vrm) return;

    vrm.scene.updateMatrixWorld(true);
    const headNode = vrm.humanoid?.getRawBoneNode('head') ?? null;
    const headWorld = new THREE.Vector3();
    if (headNode) headNode.getWorldPosition(headWorld);

    const box = new THREE.Box3().setFromObject(vrm.scene);
    const size = box.getSize(new THREE.Vector3());
    const height = Number.isFinite(size.y) && size.y > 0.1 ? size.y : 1.6;

    const frameHeight = Math.max(0.25, height * 0.36);
    const centerX = headNode ? headWorld.x : 0;
    const centerY = headNode ? headWorld.y : box.min.y + height * 0.85;
    const centerZ = headNode ? headWorld.z : 0;

    const fovRadians = (this.camera.fov * Math.PI) / 180;
    const distance = ((frameHeight * 0.5) / Math.tan(fovRadians / 2)) * 1.05;

    this.baseCenter.set(centerX, centerY - frameHeight * 0.15, centerZ);
    this.baseDistance = distance;
    this.baseFrameHeight = frameHeight;
    this.applyCameraTransform();
  }

  private applyCameraTransform(): void {
    const zoom = clamp(this.cameraConfig.zoom, 0.5, 2.5);
    const dist = this.baseDistance / zoom;
    const yawRad = (clamp(this.cameraConfig.orbitYaw, -45, 45) * Math.PI) / 180;
    const panX = clamp(this.cameraConfig.offsetX, -0.4, 0.4) * this.baseFrameHeight * 1.4;
    const panY = clamp(this.cameraConfig.offsetY, -0.4, 0.4) * this.baseFrameHeight * 1.4;

    const targetX = this.baseCenter.x - panX;
    const targetY = this.baseCenter.y + panY;
    const targetZ = this.baseCenter.z;

    this.camera.position.set(
      targetX + Math.sin(yawRad) * dist,
      targetY + this.baseFrameHeight * 0.04,
      targetZ + Math.cos(yawRad) * dist,
    );
    this.camera.lookAt(targetX, targetY, targetZ);
    this.camera.updateProjectionMatrix();
  }

  render(
    landmarks: Landmark[] | null,
    expression?: ExpressionState,
    tuning: TrackingTuning = DEFAULT_TRACKING_TUNING,
    audioMouth = 0,
  ): boolean {
    if (!this.ready || !this.vrm || !this.renderer) return false;
    const delta = Math.min(this.clock.getDelta(), 0.1);
    this.elapsedSec += delta;
    const nowMs = this.elapsedSec * 1000;
    const autoBlinkVal = tuning.autoBlink ? sampleAutoBlink(nowMs, this.blinkState) : 0;

    if (landmarks && landmarks.length > 0) {
      try {
        const riggedFace = Face.solve(landmarks, { runtime: 'mediapipe', video: null });
        if (riggedFace) {
          this.applyFace(riggedFace, expression, tuning, audioMouth, autoBlinkVal);
        }
      } catch (err) {
        console.warn('VRM: could not solve face pose, holding last pose', err);
      }
    } else {
      this.applyIdleAndManual(expression, tuning, audioMouth, autoBlinkVal);
    }

    this.applyBreathing(tuning.idleBreathing);
    this.vrm.update(delta);
    this.renderer.render(this.scene, this.camera);
    return true;
  }

  private applyBreathing(enabled: boolean): void {
    const vrm = this.vrm;
    if (!vrm) return;
    const chest =
      vrm.humanoid?.getNormalizedBoneNode('upperChest') ??
      vrm.humanoid?.getNormalizedBoneNode('chest') ??
      vrm.humanoid?.getNormalizedBoneNode('spine');
    if (chest) {
      const breath = enabled ? Math.sin(this.elapsedSec * 2.1) * 0.025 : 0;
      chest.rotation.x = lerp(chest.rotation.x, breath, 0.15);
    }
  }

  private applyIdleAndManual(
    expression: ExpressionState | undefined,
    tuning: TrackingTuning,
    audioMouth: number,
    autoBlinkVal: number,
  ): void {
    const em = this.vrm?.expressionManager;
    if (!em) return;
    const smileActive = (expression?.eyeSmile ?? 0) > 0.5;
    em.setValue('blinkLeft', smileActive ? 0 : clamp01(autoBlinkVal));
    em.setValue('blinkRight', smileActive ? 0 : clamp01(autoBlinkVal));
    em.setValue('aa', clamp01(Math.max(audioMouth, expression?.mouthOpen ?? 0)));
    em.setValue('oh', clamp01(audioMouth * 0.35));
    if (expression) {
      this.applyManualExpressions(expression, audioMouth);
    }
    if (tuning.idleBreathing && this.vrm?.humanoid) {
      const head = this.vrm.humanoid.getNormalizedBoneNode('head');
      if (head) {
        head.rotation.y = lerp(head.rotation.y, Math.sin(this.elapsedSec * 0.7) * 0.04, 0.08);
        head.rotation.z = lerp(head.rotation.z, Math.sin(this.elapsedSec * 1.05) * 0.02, 0.08);
      }
    }
  }

  private applyManualExpressions(expression: ExpressionState, audioMouth = 0): void {
    const em = this.vrm?.expressionManager;
    if (!em) return;
    const smile = Math.max(clamp01(expression.eyeSmile), clamp01(expression.cheekPuff * 0.45));
    em.setValue('happy', smile);
    em.setValue(
      'surprised',
      expression.eyeSmile > 0.5 ? 0 : clamp01(expression.eyebrowRaise * 0.75),
    );
    em.setValue('angry', clamp01(expression.angry ?? 0));
    em.setValue('sad', clamp01(expression.sad ?? 0));
    em.setValue('relaxed', clamp01(expression.relaxed ?? 0));
    em.setValue(
      'aa',
      Math.max(clamp01(this.smoothed.aa), clamp01(expression.mouthOpen), clamp01(audioMouth)),
    );
  }

  private applyFace(
    riggedFace: NonNullable<ReturnType<typeof Face.solve>>,
    expression: ExpressionState | undefined,
    tuning: TrackingTuning,
    audioMouth: number,
    autoBlinkVal: number,
  ): void {
    const vrm = this.vrm;
    if (!vrm) return;
    const s = this.smoothed;
    const sens = clamp(tuning.headSensitivity, 0.25, 2.5);
    const smoothFactor = clamp(tuning.smoothing, 0, 0.92);
    const headAlpha = clamp(1 - smoothFactor * 0.85, 0.08, 1);
    const mouthAlpha = clamp(1 - smoothFactor * 0.62, 0.18, 1);
    const blinkAlpha = clamp(1 - smoothFactor * 0.48, 0.28, 1);

    this.lastRawHead = {
      x: riggedFace.head.x,
      y: riggedFace.head.y,
      z: riggedFace.head.z,
    };

    const calX = this.headCalibration?.x ?? 0;
    const calY = this.headCalibration?.y ?? 0;
    const calZ = this.headCalibration?.z ?? 0;

    const targetX = (riggedFace.head.x - calX) * sens;
    const targetY = (riggedFace.head.y - calY) * sens;
    const targetZ = (riggedFace.head.z - calZ) * sens;

    s.headX = lerp(s.headX, targetX, headAlpha);
    s.headY = lerp(s.headY, targetY, headAlpha);
    s.headZ = lerp(s.headZ, targetZ, headAlpha);

    // Split head rotation organically across head + neck + subtle spine follow
    const headBone = vrm.humanoid?.getNormalizedBoneNode('head');
    const neckBone = vrm.humanoid?.getNormalizedBoneNode('neck');
    const spineBone = vrm.humanoid?.getNormalizedBoneNode('spine');

    if (headBone) {
      const share = neckBone ? 0.68 : 1.0;
      headBone.rotation.set(s.headX * share, s.headY * share, s.headZ * share);
    }
    if (neckBone) {
      neckBone.rotation.set(s.headX * 0.32, s.headY * 0.32, s.headZ * 0.32);
    }
    if (spineBone) {
      spineBone.rotation.y = lerp(spineBone.rotation.y, s.headY * 0.18, 0.15);
      spineBone.rotation.z = lerp(spineBone.rotation.z, s.headZ * 0.14, 0.15);
    }

    // Drive VRM eye lookAt from pupil tracking
    if (riggedFace.pupil) {
      s.pupilX = lerp(s.pupilX, riggedFace.pupil.x, 0.35);
      s.pupilY = lerp(s.pupilY, riggedFace.pupil.y, 0.35);
      this.lookAtTarget.position.set(
        this.baseCenter.x + s.pupilX * 1.2,
        this.baseCenter.y + s.pupilY * 0.8,
        this.baseCenter.z + 2.2,
      );
    }

    const em = vrm.expressionManager;
    if (em) {
      s.blinkL = lerp(s.blinkL, Math.max(1 - riggedFace.eye.l, autoBlinkVal), blinkAlpha);
      s.blinkR = lerp(s.blinkR, Math.max(1 - riggedFace.eye.r, autoBlinkVal), blinkAlpha);
      const smileActive = (expression?.eyeSmile ?? 0) > 0.5;
      em.setValue('blinkLeft', smileActive ? 0 : clamp01(s.blinkL));
      em.setValue('blinkRight', smileActive ? 0 : clamp01(s.blinkR));

      const m = riggedFace.mouth.shape;
      s.aa = lerp(s.aa, Math.max(m.A, audioMouth), mouthAlpha);
      s.ih = lerp(s.ih, m.I, mouthAlpha);
      s.ou = lerp(s.ou, m.U, mouthAlpha);
      s.ee = lerp(s.ee, m.E, mouthAlpha);
      s.oh = lerp(s.oh, Math.max(m.O, audioMouth * 0.35), mouthAlpha);
      em.setValue('aa', Math.max(clamp01(s.aa), clamp01(expression?.mouthOpen ?? 0)));
      em.setValue('ih', clamp01(s.ih));
      em.setValue('ou', clamp01(s.ou));
      em.setValue('ee', clamp01(s.ee));
      em.setValue('oh', clamp01(s.oh));

      if (expression) {
        this.applyManualExpressions(expression, audioMouth);
      }
    }
  }

  resize(w: number, h: number): void {
    if (!this.renderer) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  destroy(): void {
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = null;
    }
    this.renderer?.dispose();
    this.renderer = null;
    this.ready = false;
  }
}
