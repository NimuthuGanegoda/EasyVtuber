// Real character rendering via a VRM (rigged 3D anime avatar) model, driven
// by Kalidokit's solver over raw MediaPipe face landmarks. This replaces the
// hand-drawn procedural shapes in webglRenderer.ts/App.tsx's drawCharacter()
// once a real .vrm model is present — see the "Character model" section of
// web/README (or App.tsx's fallback chain) for how the two coexist.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Face } from 'kalidokit';
import type { Landmark } from './poseExtractor';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Smoothing rates: blink stays snappy, head rotation gets the heaviest
// smoothing since it's the most jitter-visible signal — same rationale as
// the smoothing already applied to the procedural renderers in App.tsx.
const SMOOTH_BLINK = 0.55;
const SMOOTH_MOUTH = 0.4;
const SMOOTH_HEAD = 0.3;

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
  private smoothed: SmoothedFace = {
    blinkL: 0, blinkR: 0, aa: 0, ih: 0, ou: 0, ee: 0, oh: 0, headX: 0, headY: 0, headZ: 0,
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(22, 1, 0.1, 20);
    // Framed roughly on a bust/headshot — VRM humanoid rest pose has the
    // head around y=1.4-1.5m for a standard adult-proportioned model.
    this.camera.position.set(0, 1.42, 1.1);
    this.camera.lookAt(0, 1.4, 0);
    this.clock = new THREE.Clock();

    try {
      this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
      this.renderer.setSize(canvas.width, canvas.height, false);
      this.renderer.setPixelRatio(1);
    } catch (e) {
      console.warn('VRM: WebGL renderer init failed, falling back', e);
      this.renderer = null;
    }

    const key = new THREE.DirectionalLight(0xfff4ee, 1.3);
    key.position.set(0.6, 1.2, 1.2);
    this.scene.add(key);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  }

  isReady(): boolean {
    return this.ready;
  }

  isLoading(): boolean {
    return this.loading;
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

      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      // VRM 0.x models face +Z (away from a default-facing camera); rotate
      // to match VRM 1.0's -Z-toward-viewer convention.
      if (vrm.meta && 'metaVersion' in vrm.meta && vrm.meta.metaVersion === '0') {
        VRMUtils.rotateVRM0(vrm);
      }

      this.scene.add(vrm.scene);
      this.vrm = vrm;
      this.ready = true;
      return true;
    } catch (e) {
      console.warn('VRM: failed to load model:', e);
      this.ready = false;
      return false;
    } finally {
      this.loading = false;
    }
  }

  /** Returns true if it drew a frame (mirrors WebGLCharacterRenderer's contract). */
  render(landmarks: Landmark[] | null): boolean {
    if (!this.ready || !this.vrm || !this.renderer) return false;
    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (landmarks && landmarks.length > 0) {
      const riggedFace = Face.solve(landmarks, { runtime: 'mediapipe', video: null });
      if (riggedFace) this.applyFace(riggedFace);
    }

    this.vrm.update(delta);
    this.renderer.render(this.scene, this.camera);
    return true;
  }

  private applyFace(riggedFace: NonNullable<ReturnType<typeof Face.solve>>): void {
    const vrm = this.vrm;
    if (!vrm) return;
    const s = this.smoothed;

    const headBone = vrm.humanoid?.getNormalizedBoneNode('head');
    if (headBone) {
      s.headX = lerp(s.headX, riggedFace.head.x, SMOOTH_HEAD);
      s.headY = lerp(s.headY, riggedFace.head.y, SMOOTH_HEAD);
      s.headZ = lerp(s.headZ, riggedFace.head.z, SMOOTH_HEAD);
      headBone.rotation.set(s.headX, s.headY, s.headZ);
    }

    const em = vrm.expressionManager;
    if (em) {
      // eye.l/r from Kalidokit is openness (0=closed, 1=open); VRM's
      // blink expressions are the opposite (0=open, 1=fully closed).
      s.blinkL = lerp(s.blinkL, 1 - riggedFace.eye.l, SMOOTH_BLINK);
      s.blinkR = lerp(s.blinkR, 1 - riggedFace.eye.r, SMOOTH_BLINK);
      em.setValue('blinkLeft', clamp01(s.blinkL));
      em.setValue('blinkRight', clamp01(s.blinkR));

      const m = riggedFace.mouth.shape;
      s.aa = lerp(s.aa, m.A, SMOOTH_MOUTH);
      s.ih = lerp(s.ih, m.I, SMOOTH_MOUTH);
      s.ou = lerp(s.ou, m.U, SMOOTH_MOUTH);
      s.ee = lerp(s.ee, m.E, SMOOTH_MOUTH);
      s.oh = lerp(s.oh, m.O, SMOOTH_MOUTH);
      em.setValue('aa', clamp01(s.aa));
      em.setValue('ih', clamp01(s.ih));
      em.setValue('ou', clamp01(s.ou));
      em.setValue('ee', clamp01(s.ee));
      em.setValue('oh', clamp01(s.oh));
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
