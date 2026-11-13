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
}

export type BackgroundType = 'none' | 'gradient' | 'blur';

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
