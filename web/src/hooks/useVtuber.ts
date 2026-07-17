import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { extractPose, PoseData as PoseExtractData } from '../utils/poseExtractor';

// Re-export for use in App.tsx
export type PoseData = PoseExtractData;

const MP_VERSION = '0.10.18';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;

export interface ExpressionState {
  mouthOpen: number;
  eyebrowRaise: number;
  eyeSmile: number;
  cheekPuff: number;
}

export interface HotkeyAction {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: string;
  label: string;
}

export type BackgroundType = 'none' | 'gradient' | 'image' | 'blur' | 'game';

export interface VtuberState {
  status: string;
  isLoaded: boolean;
  error: string | null;
  inferenceTime: number;
  fps: number;
  progress: number;
  pose: PoseData | null;
  expression: ExpressionState;
  handTracking: boolean;
  background: BackgroundType;
  backgroundValue: string;
  overlays: OverlayItem[];
  hotkeys: HotkeyAction[];
  isTracking: boolean;
}

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

const DEFAULT_EXPRESSION: ExpressionState = {
  mouthOpen: 0,
  eyebrowRaise: 0,
  eyeSmile: 0,
  cheekPuff: 0
};

const DEFAULT_OVERLAYS: OverlayItem[] = [
  { id: '1', type: 'emoji', content: '🌸', x: 0.8, y: 0.1, scale: 1, rotation: 0, opacity: 0.8 },
  { id: '2', type: 'image', content: '', x: 0.1, y: 0.1, scale: 1, rotation: 0, opacity: 1 },
];

const DEFAULT_HOTKEYS: HotkeyAction[] = [
  { key: '1', action: 'expression_mouth_open', label: 'Open Mouth' },
  { key: '2', action: 'expression_eyebrow_raise', label: 'Raise Brow' },
  { key: '3', action: 'expression_eye_smile', label: 'Eye Smile' },
  { key: '4', action: 'expression_cheek_puff', label: 'Cheek Puff' },
  { key: 'r', action: 'reset_pose', label: 'Reset Pose' },
  { key: 'h', action: 'toggle_hands', label: 'Toggle Hands' },
  { key: 'b', action: 'cycle_background', label: 'Cycle BG' },
  { key: ' ', action: 'toggle_tracking', label: 'Toggle Track' },
];

export function useVtuber() {
  const poseRef = useRef<PoseData | null>(null);
  const overlaysRef = useRef<OverlayItem[]>(DEFAULT_OVERLAYS);
  const trackingStateRef = useRef(true);

  const [state, setState] = useState<VtuberState>({
    status: 'Initializing Core Systems...',
    isLoaded: false,
    error: null,
    inferenceTime: 0,
    fps: 0,
    progress: 0,
    pose: null,
    expression: DEFAULT_EXPRESSION,
    handTracking: false,
    background: 'gradient',
    backgroundValue: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
    overlays: DEFAULT_OVERLAYS,
    hotkeys: DEFAULT_HOTKEYS,
    isTracking: true,
  });

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const requestRef = useRef<number>(0);
  const fpsFrames = useRef<number[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const expressionRef = useRef<ExpressionState>(DEFAULT_EXPRESSION);
  const hotkeysRef = useRef<HotkeyAction[]>(DEFAULT_HOTKEYS);
  const trackingRef = useRef(true);

  const updateState = useCallback((partial: Partial<VtuberState>) => {
    setState(prev => ({ ...prev, ...partial }));
  }, []);

  const setExpression = useCallback((expr: Partial<ExpressionState>) => {
    const updated = { ...expressionRef.current, ...expr };
    expressionRef.current = updated;
    setState(prev => ({ ...prev, expression: updated }));
  }, []);

  const resetExpression = useCallback(() => {
    expressionRef.current = DEFAULT_EXPRESSION;
    setState(prev => ({ ...prev, expression: DEFAULT_EXPRESSION }));
  }, []);

  const setBackground = useCallback((bg: BackgroundType, value?: string) => {
    const defaults: Record<BackgroundType, string> = {
      none: 'transparent',
      gradient: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
      image: '',
      blur: 'rgba(0,0,0,0.6)',
      game: '#1a1a2e',
    };
    setState(prev => ({
      ...prev,
      background: bg,
      backgroundValue: value || defaults[bg],
    }));
  }, []);

  const toggleTracking = useCallback(() => {
    trackingRef.current = !trackingRef.current;
    setState(prev => ({ ...prev, isTracking: trackingRef.current }));
  }, []);

  const addOverlay = useCallback((overlay: OverlayItem) => {
    overlaysRef.current = [...overlaysRef.current, overlay];
    setState(prev => ({ ...prev, overlays: overlaysRef.current }));
  }, []);

  const removeOverlay = useCallback((id: string) => {
    overlaysRef.current = overlaysRef.current.filter(o => o.id !== id);
    setState(prev => ({ ...prev, overlays: overlaysRef.current }));
  }, []);

  const updateOverlay = useCallback((id: string, partial: Partial<OverlayItem>) => {
    overlaysRef.current = overlaysRef.current.map(o => o.id === id ? { ...o, ...partial } : o);
    setState(prev => ({ ...prev, overlays: overlaysRef.current }));
  }, []);

  const loadModels = useCallback(async (videoElement: HTMLVideoElement) => {
    updateState({ status: 'Loading Face Landmarker...', progress: 10 });
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      updateState({ status: 'Initializing Face Mesh...', progress: 25 });

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
          delegate: 'GPU',
        },
        outputFaceBlendshapes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      faceLandmarkerRef.current = faceLandmarker;

      // HandLandmarker will be loaded on-demand when user enables hand tracking

      updateState({ status: 'Opening Camera...', progress: 50 });
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
        },
      });

      videoElement.srcObject = stream;
      streamRef.current = stream;

      await new Promise<void>((resolve) => {
        videoElement.onloadedmetadata = () => {
          videoElement.play();
          resolve();
        };
      });

      videoRef.current = videoElement;
      updateState({ status: 'Core Systems Online', progress: 100, isLoaded: true });
      requestRef.current = requestAnimationFrame(loop);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      updateState({ error: `Boot Failure: ${message}`, status: 'System Restoration Required' });
    }
  }, [updateState]);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const faceLm = faceLandmarkerRef.current;
    if (!video || !faceLm) {
      requestRef.current = requestAnimationFrame(loop);
      return;
    }

    const now = performance.now();

    // Track FPS
    fpsFrames.current = [...fpsFrames.current.filter(t => now - t < 1000), now];
    const currentFps = fpsFrames.current.length;

    try {
      if (trackingRef.current) {
        const faceResult = faceLm.detectForVideo(video, now);
        if (faceResult.faceLandmarks && faceResult.faceLandmarks.length > 0) {
          const landmarks = faceResult.faceLandmarks[0];
          if (landmarks) {
            const pose = extractPose(landmarks);
            poseRef.current = pose;
            trackingStateRef.current = trackingRef.current;
            setState(prev => ({ ...prev, pose, fps: currentFps }));
          }
        }
      }
    } catch {
      // Silently continue if frame processing fails
    }

    requestRef.current = requestAnimationFrame(loop);
  }, []);

  const handleHotkey = useCallback((e: KeyboardEvent) => {
    const action = hotkeysRef.current.find(h => {
      if (e.key !== h.key && e.key.toLowerCase() !== h.key.toLowerCase()) return false;
      if (h.ctrl && !e.ctrlKey) return false;
      if (h.alt && !e.altKey) return false;
      if (h.shift && !e.shiftKey) return false;
      return true;
    });

    if (!action) return;
    e.preventDefault();

    switch (action.action) {
      case 'expression_mouth_open':
        setExpression({ mouthOpen: expressionRef.current.mouthOpen > 0.5 ? 0 : 1 });
        break;
      case 'expression_eyebrow_raise':
        setExpression({ eyebrowRaise: expressionRef.current.eyebrowRaise > 0.5 ? 0 : 1 });
        break;
      case 'expression_eye_smile':
        setExpression({ eyeSmile: expressionRef.current.eyeSmile > 0.5 ? 0 : 1 });
        break;
      case 'expression_cheek_puff':
        setExpression({ cheekPuff: expressionRef.current.cheekPuff > 0.5 ? 0 : 1 });
        break;
      case 'reset_pose':
        resetExpression();
        break;
      case 'toggle_hands':
        setState(prev => ({ ...prev, handTracking: !prev.handTracking }));
        break;
      case 'cycle_background': {
        const bgs: BackgroundType[] = ['gradient', 'none', 'blur'];
        setState(prev => {
          const idx = bgs.indexOf(prev.background);
          const next = bgs[(idx + 1) % bgs.length];
          setBackground(next);
          return prev;
        });
        break;
      }
      case 'toggle_tracking':
        toggleTracking();
        break;
    }
  }, [setExpression, resetExpression, setBackground, toggleTracking]);

  useEffect(() => {
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [handleHotkey]);

  // Stop video loop on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      faceLandmarkerRef.current?.close();
    };
  }, []);

  return {
    ...state,
    loadModels,
    setExpression,
    resetExpression,
    setBackground,
    toggleTracking,
    addOverlay,
    removeOverlay,
    updateOverlay,
    setState: updateState,
  };
}
