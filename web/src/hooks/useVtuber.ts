import { useState, useEffect, useRef, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { extractPose, PoseData as PoseExtractData, Landmark } from '../utils/poseExtractor';
import type {
  BackgroundType,
  ExpressionState,
  HotkeyAction,
  InferenceDelegate,
  OverlayItem,
} from '../types';

// Re-export for use in App.tsx (kept for backwards compatibility).
export type PoseData = PoseExtractData;
export type { BackgroundType, ExpressionState, HotkeyAction, InferenceDelegate, OverlayItem };

const MP_VERSION = '0.10.18';
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const FACE_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

/** How long to wait for the camera to report metadata before failing loudly. */
const CAMERA_METADATA_TIMEOUT_MS = 5000;
/** Throttle React state updates to ~20fps — the RAF loop drives the visuals. */
const STATE_SYNC_INTERVAL_MS = 50;
/** Don't repeat the same tracking error into the UI more often than this. */
const ERROR_REPEAT_INTERVAL_MS = 5000;

export interface VtuberState {
  status: string;
  isLoaded: boolean;
  error: string | null;
  /** Non-fatal, live tracking problem (e.g. a frame that could not be solved). */
  trackingError: string | null;
  inferenceTime: number;
  /** Frames actually run through the model per second (not the display refresh rate). */
  fps: number;
  progress: number;
  pose: PoseData | null;
  expression: ExpressionState;
  background: BackgroundType;
  backgroundValue: string;
  overlays: OverlayItem[];
  hotkeys: HotkeyAction[];
  isTracking: boolean;
  useWorker: boolean;
  maxFps: number;
  delegate: InferenceDelegate;
  cameras: MediaDeviceInfo[];
}

export interface LoadModelOptions {
  delegate?: InferenceDelegate;
  /** Exact deviceId from `cameras`. Omit for the system default. */
  deviceId?: string;
}

const DEFAULT_EXPRESSION: ExpressionState = {
  mouthOpen: 0,
  eyebrowRaise: 0,
  eyeSmile: 0,
  cheekPuff: 0,
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
  { key: 'b', action: 'cycle_background', label: 'Cycle BG' },
  { key: ' ', action: 'toggle_tracking', label: 'Toggle Track' },
];

export const BACKGROUND_DEFAULTS: Record<BackgroundType, string> = {
  none: 'transparent',
  gradient: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
  blur: 'rgba(0,0,0,0.6)',
};

const BACKGROUND_ORDER: BackgroundType[] = ['gradient', 'none', 'blur'];

function describeCameraError(err: unknown, deviceId?: string): string {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera found. Connect a webcam and try again.';
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was denied. Allow camera permissions for this site and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is already in use by another application. Close it and try again.';
    case 'OverconstrainedError':
      return deviceId
        ? 'The selected camera is no longer available. Pick another source in Settings.'
        : 'The camera does not support the requested video format.';
    default:
      return `Could not access camera: ${err instanceof Error ? err.message : String(err)}`;
  }
}

/**
 * Resolve once the video element has metadata and is playing, or reject on
 * error/timeout. The previous implementation awaited `onloadedmetadata` with no
 * timeout at all, so a denied or stalled camera left the UI on the loading
 * spinner forever.
 */
function waitForVideoReady(video: HTMLVideoElement, timeoutMs = CAMERA_METADATA_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('error', onError);
    };
    const onLoaded = () => {
      cleanup();
      void video.play().catch(() => {
        /* autoplay can be blocked; detectForVideo still works on a ready video */
      });
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('The camera stream failed to load (the device may be in use).'));
    };
    const timer = window.setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `The camera did not start within ${timeoutMs / 1000}s. Check that no other app is using it.`,
        ),
      );
    }, timeoutMs);

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      onLoaded();
      return;
    }
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('error', onError);
  });
}

export function useVtuber() {
  const poseRef = useRef<PoseData | null>(null);
  // Raw MediaPipe landmarks, exposed alongside the derived PoseData for
  // renderers that do their own solving from raw points (e.g. Kalidokit for
  // driving a VRM model) rather than consuming our extractPose() output.
  const landmarksRef = useRef<Landmark[] | null>(null);
  const overlaysRef = useRef<OverlayItem[]>(DEFAULT_OVERLAYS);
  const expressionRef = useRef<ExpressionState>(DEFAULT_EXPRESSION);
  const hotkeysRef = useRef<HotkeyAction[]>(DEFAULT_HOTKEYS);
  const trackingRef = useRef(true);
  const maxFpsRef = useRef(30);
  const backgroundRef = useRef<BackgroundType>('gradient');

  const [state, setState] = useState<VtuberState>({
    status: 'Initializing Core Systems...',
    isLoaded: false,
    error: null,
    trackingError: null,
    inferenceTime: 0,
    fps: 0,
    progress: 0,
    pose: null,
    expression: DEFAULT_EXPRESSION,
    background: 'gradient',
    backgroundValue: BACKGROUND_DEFAULTS.gradient,
    overlays: DEFAULT_OVERLAYS,
    hotkeys: DEFAULT_HOTKEYS,
    isTracking: true,
    useWorker: true,
    maxFps: 30,
    delegate: 'GPU',
    cameras: [],
  });

  // Keep refs in sync with the latest render so the stable loops below read
  // current values without being re-created.
  hotkeysRef.current = state.hotkeys;
  maxFpsRef.current = state.maxFps;
  backgroundRef.current = state.background;

  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fpsFrames = useRef<number[]>([]);
  const lastStateSyncRef = useRef(0);
  const lastDetectRef = useRef(0);
  const frameIdRef = useRef(0);
  const generationRef = useRef(0);
  const lastErrorRef = useRef<{ message: string; at: number } | null>(null);
  const hasTrackingErrorRef = useRef(false);

  const workerRef = useRef<Worker | null>(null);
  const workerPoseRef = useRef<PoseData | null>(null);
  // One in-flight frame at a time: without this, frames queue inside the
  // worker whenever inference is slower than the display rate, and the avatar
  // drifts progressively further behind the camera.
  const workerInFlightRef = useRef(false);
  const lastWorkerIdRef = useRef(0);

  const useWorkerRef = useRef(state.useWorker);
  useWorkerRef.current = state.useWorker;

  const updateState = useCallback((partial: Partial<VtuberState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const clearTrackingError = useCallback(() => {
    if (!hasTrackingErrorRef.current) return;
    hasTrackingErrorRef.current = false;
    lastErrorRef.current = null;
    setState((prev) => (prev.trackingError === null ? prev : { ...prev, trackingError: null }));
  }, []);

  const reportTrackingError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const now = performance.now();
    const last = lastErrorRef.current;
    if (last && last.message === message && now - last.at < ERROR_REPEAT_INTERVAL_MS) return;
    lastErrorRef.current = { message, at: now };
    hasTrackingErrorRef.current = true;
    console.warn('[EasyVtuber] tracking error:', message);
    setState((prev) =>
      prev.trackingError === message ? prev : { ...prev, trackingError: message },
    );
  }, []);

  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      setState((prev) => ({ ...prev, cameras }));
    } catch (err) {
      // Enumeration is a convenience; never block tracking on it.
      console.info('[EasyVtuber] could not enumerate cameras:', err);
    }
  }, []);

  /** Stop the camera, cancel the loop and release the landmarker. Idempotent. */
  const disposeSession = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.onloadedmetadata = null;
      video.srcObject = null;
    }
    if (faceLandmarkerRef.current) {
      try {
        faceLandmarkerRef.current.close();
      } catch {
        // Already closed — nothing to do.
      }
      faceLandmarkerRef.current = null;
    }
    poseRef.current = null;
    landmarksRef.current = null;
    workerPoseRef.current = null;
    workerInFlightRef.current = false;
  }, []);

  const loadModels = useCallback(
    async (videoElement: HTMLVideoElement, options: LoadModelOptions = {}) => {
      const generation = ++generationRef.current;
      const delegate = options.delegate ?? 'GPU';
      disposeSession();
      videoRef.current = videoElement;
      updateState({
        status: 'Loading Face Landmarker...',
        progress: 10,
        error: null,
        trackingError: null,
        isLoaded: false,
        delegate,
      });

      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        if (generation !== generationRef.current) return;

        updateState({ status: 'Initializing Face Mesh...', progress: 25 });
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO',
          numFaces: 1,
        });
        if (generation !== generationRef.current) {
          faceLandmarker.close();
          return;
        }
        faceLandmarkerRef.current = faceLandmarker;

        updateState({ status: 'Opening Camera...', progress: 50 });
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
              frameRate: { ideal: 30 },
              ...(options.deviceId ? { deviceId: { exact: options.deviceId } } : {}),
            },
          });
        } catch (camErr: unknown) {
          throw new Error(describeCameraError(camErr, options.deviceId));
        }
        if (generation !== generationRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        videoElement.srcObject = stream;
        await waitForVideoReady(videoElement);
        if (generation !== generationRef.current) return;

        lastStateSyncRef.current = 0;
        lastDetectRef.current = 0;
        fpsFrames.current = [];
        updateState({ status: 'Core Systems Online', progress: 100, isLoaded: true });
        // Labels are only exposed after permission is granted, so this is the
        // first moment the source picker can show real camera names.
        void refreshCameras();
      } catch (err: unknown) {
        if (generation !== generationRef.current) return;
        const message = err instanceof Error ? err.message : String(err);
        disposeSession();
        updateState({
          error: `Boot Failure: ${message}`,
          status: 'System Restoration Required',
          isLoaded: false,
          progress: 0,
        });
      }
    },
    [disposeSession, refreshCameras, updateState],
  );

  /** One detection step. Stable across renders; reads everything from refs. */
  const runFrame = useCallback(() => {
    const video = videoRef.current;
    const faceLandmarker = faceLandmarkerRef.current;
    if (!video || !faceLandmarker) return;

    const now = performance.now();
    const minInterval = maxFpsRef.current > 0 ? 1000 / maxFpsRef.current : 0;
    if (minInterval > 0 && now - lastDetectRef.current < minInterval) return;
    lastDetectRef.current = now;

    if (!trackingRef.current) return;

    try {
      const detectStart = performance.now();
      const faceResult = faceLandmarker.detectForVideo(video, now);
      const detectMs = performance.now() - detectStart;

      // FPS counts frames actually pushed through the model — measuring the
      // RAF rate instead reported the display refresh rate (e.g. 120 on a
      // 120Hz screen) regardless of how fast inference really was.
      fpsFrames.current.push(now);
      while (fpsFrames.current.length > 0 && (fpsFrames.current[0] ?? 0) < now - 1000) {
        fpsFrames.current.shift();
      }

      const landmarks = faceResult.faceLandmarks?.[0];
      if (landmarks) {
        const rawLandmarks = landmarks as unknown as Landmark[];
        landmarksRef.current = rawLandmarks;

        // MediaPipe's ML-derived blendshape scores (blink, jaw-open, etc.) are
        // materially more accurate than geometry computed from raw landmarks
        // alone — pass them through when available.
        const categories = faceResult.faceBlendshapes?.[0]?.categories;
        const blendshapes = categories
          ? Object.fromEntries(categories.map((c) => [c.categoryName, c.score]))
          : undefined;

        // The transformation matrix gives accurate head pose (see
        // poseExtractor.ts) — pass the raw column-major data through.
        const transformMatrix = faceResult.facialTransformationMatrixes?.[0]?.data;

        const worker = workerRef.current;
        if (worker && useWorkerRef.current) {
          if (!workerInFlightRef.current) {
            workerInFlightRef.current = true;
            frameIdRef.current += 1;
            worker.postMessage({
              id: frameIdRef.current,
              landmarks: rawLandmarks,
              blendshapes,
              transformMatrix,
            });
          }
          if (workerPoseRef.current) poseRef.current = workerPoseRef.current;
        } else {
          poseRef.current = extractPose(rawLandmarks, blendshapes, transformMatrix);
        }
        clearTrackingError();
      }

      // Throttle React state updates to ~20fps
      if (now - lastStateSyncRef.current > STATE_SYNC_INTERVAL_MS) {
        lastStateSyncRef.current = now;
        const fps = fpsFrames.current.length;
        const pose = poseRef.current;
        setState((prev) => ({
          ...prev,
          pose,
          fps,
          inferenceTime: Math.round(detectMs),
        }));
      }
    } catch (err) {
      // Surface instead of silently freezing the avatar.
      reportTrackingError(err);
    }
  }, [clearTrackingError, reportTrackingError]);

  // Drive the detection loop while a session is live. Split out from
  // loadModels so there is no effect/callback dependency cycle.
  useEffect(() => {
    if (!state.isLoaded) return;
    let running = true;
    const step = () => {
      if (!running) return;
      runFrame();
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [state.isLoaded, runFrame]);

  // Spawn or kill the Web Worker when the user toggles the setting
  useEffect(() => {
    if (!state.useWorker) {
      workerRef.current?.terminate();
      workerRef.current = null;
      workerPoseRef.current = null;
      workerInFlightRef.current = false;
      return;
    }
    try {
      const worker = new Worker(new URL('../utils/poseWorker.ts', import.meta.url), {
        type: 'module',
      });
      worker.onmessage = (
        event: MessageEvent<{ id?: number; pose?: PoseData; error?: string }>,
      ) => {
        workerInFlightRef.current = false;
        const data = event.data;
        if (!data) return;
        if (data.error) {
          reportTrackingError(new Error(data.error));
          return;
        }
        if (data.pose && typeof data.id === 'number' && data.id >= lastWorkerIdRef.current) {
          lastWorkerIdRef.current = data.id;
          workerPoseRef.current = data.pose;
          clearTrackingError();
        }
      };
      worker.onerror = (event) => {
        workerInFlightRef.current = false;
        reportTrackingError(new Error(event.message || 'Pose worker crashed'));
      };
      workerRef.current = worker;
    } catch (err) {
      console.warn('Pose worker init failed, using main-thread extraction:', err);
      setState((prev) => ({ ...prev, useWorker: false }));
    }

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      workerPoseRef.current = null;
      workerInFlightRef.current = false;
    };
  }, [state.useWorker, clearTrackingError, reportTrackingError]);

  const setUseWorker = useCallback((enabled: boolean) => {
    setState((prev) => ({ ...prev, useWorker: enabled }));
  }, []);

  const setMaxFps = useCallback((maxFps: number) => {
    setState((prev) => ({ ...prev, maxFps }));
  }, []);

  const setExpression = useCallback((expr: Partial<ExpressionState>) => {
    const updated = { ...expressionRef.current, ...expr };
    expressionRef.current = updated;
    setState((prev) => ({ ...prev, expression: updated }));
  }, []);

  const resetExpression = useCallback(() => {
    expressionRef.current = DEFAULT_EXPRESSION;
    setState((prev) => ({ ...prev, expression: DEFAULT_EXPRESSION }));
  }, []);

  const setBackground = useCallback((bg: BackgroundType, value?: string) => {
    setState((prev) => ({
      ...prev,
      background: bg,
      backgroundValue: value || BACKGROUND_DEFAULTS[bg],
    }));
  }, []);

  const toggleTracking = useCallback(() => {
    trackingRef.current = !trackingRef.current;
    if (trackingRef.current) {
      // Force an immediate state sync on the next frame.
      lastStateSyncRef.current = 0;
    }
    setState((prev) => ({ ...prev, isTracking: trackingRef.current }));
  }, []);

  const addOverlay = useCallback((overlay: OverlayItem) => {
    overlaysRef.current = [...overlaysRef.current, overlay];
    setState((prev) => ({ ...prev, overlays: overlaysRef.current }));
  }, []);

  const removeOverlay = useCallback((id: string) => {
    overlaysRef.current = overlaysRef.current.filter((o) => o.id !== id);
    setState((prev) => ({ ...prev, overlays: overlaysRef.current }));
  }, []);

  const updateOverlay = useCallback((id: string, partial: Partial<OverlayItem>) => {
    overlaysRef.current = overlaysRef.current.map((o) => (o.id === id ? { ...o, ...partial } : o));
    setState((prev) => ({ ...prev, overlays: overlaysRef.current }));
  }, []);

  const cycleBackground = useCallback(() => {
    const idx = BACKGROUND_ORDER.indexOf(backgroundRef.current);
    const next = BACKGROUND_ORDER[(idx + 1) % BACKGROUND_ORDER.length] ?? 'gradient';
    setBackground(next);
  }, [setBackground]);

  const handleHotkey = useCallback(
    (e: KeyboardEvent) => {
      // Don't hijack keystrokes meant for a focused form control (e.g. Space
      // toggling a checkbox, or typing into a text field).
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;

      const action = hotkeysRef.current.find((h) => {
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
        case 'cycle_background':
          cycleBackground();
          break;
        case 'toggle_tracking':
          toggleTracking();
          break;
      }
    },
    [setExpression, resetExpression, cycleBackground, toggleTracking],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleHotkey);
    return () => window.removeEventListener('keydown', handleHotkey);
  }, [handleHotkey]);

  // Release camera/landmarker/worker on unmount.
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      disposeSession();
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [disposeSession]);

  return {
    ...state,
    loadModels,
    refreshCameras,
    setExpression,
    resetExpression,
    setBackground,
    toggleTracking,
    setUseWorker,
    setMaxFps,
    addOverlay,
    removeOverlay,
    updateOverlay,
    setState: updateState,
    // Expose refs for the canvas draw loop to read without React re-renders
    poseRef,
    landmarksRef,
    overlaysRef,
    trackingRef,
    expressionRef,
  };
}
