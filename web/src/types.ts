/**
 * Shared view-model types.
 *
 * Lives outside `hooks/useVtuber.ts` so that renderers and components can
 * import them without pulling in the React hook module (which would otherwise
 * create an import cycle: hook -> renderer -> hook).
 */

export interface ExpressionState {
  mouthOpen: number;
  eyebrowRaise: number;
  eyeSmile: number;
  cheekPuff: number;
  angry?: number;
  sad?: number;
  relaxed?: number;
}

export type BackgroundType = 'none' | 'gradient' | 'blur' | 'image';

export interface OverlayItem {
  id: string;
  type: 'image' | 'emoji' | 'text';
  content: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
}

export interface HotkeyAction {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: string;
  label: string;
}

/** MediaPipe's face landmarker delegate. */
export type InferenceDelegate = 'GPU' | 'CPU';

export interface StageCameraConfig {
  zoom: number;
  offsetX: number;
  offsetY: number;
  orbitYaw: number;
}

export interface StageLightingConfig {
  preset: 'studio' | 'neon' | 'sunset' | 'moonlight';
  keyIntensity: number;
  rimIntensity: number;
  ambientIntensity: number;
  keyColor: string;
  rimColor: string;
}

export interface TrackingTuning {
  headSensitivity: number;
  smoothing: number;
  autoBlink: boolean;
  idleBreathing: boolean;
}

export type AvatarMode = 'studio' | 'png' | 'vrm';

export type AvatarAccessory = 'none' | 'fox-ears' | 'cat-ears' | 'halo' | 'glasses' | 'horns';

export type AvatarPresetId = 'sakura' | 'kitsune' | 'neko' | 'cyber' | 'midnight' | 'custom';

export interface AvatarAppearance {
  presetId: AvatarPresetId;
  hairColor: string;
  hairDark: string;
  hairLight: string;
  eyeColor: string;
  eyeDark: string;
  skinColor: string;
  skinShade: string;
  outfitColor: string;
  outfitAccent: string;
  accessory: AvatarAccessory;
}

export interface PngAvatarConfig {
  name: string;
  bounceStrength: number;
  talkThreshold: number;
  parallaxStrength: number;
}

export interface StudioProfileData {
  expression: ExpressionState;
  background: BackgroundType;
  backgroundValue: string;
  overlays: OverlayItem[];
  camera: StageCameraConfig;
  lighting: StageLightingConfig;
  tuning: TrackingTuning;
  mirrored: boolean;
  appearance?: AvatarAppearance;
}

export interface StudioProfile {
  id: string;
  name: string;
  updatedAt: number;
  data: StudioProfileData;
}
