import {
  type DragEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useVtuber, ExpressionState, PoseData, type InferenceDelegate } from './hooks/useVtuber';
import { useContributors, FALLBACK_COUNT } from './hooks/useContributors';
import { useSettings, isMaxFps, MAX_FPS_CHOICES } from './hooks/useSettings';
import { useAudioLipSync } from './hooks/useAudioLipSync';
import { useStageRecorder } from './hooks/useStageRecorder';
import { usePopoutStage } from './hooks/usePopoutStage';
import {
  DEFAULT_STAGE_CAMERA,
  LIGHTING_PRESETS,
  parseProfileJson,
  useProfiles,
} from './hooks/useProfiles';
import type {
  AvatarAppearance,
  AvatarMode,
  BackgroundType,
  PngAvatarConfig,
  StageCameraConfig,
  StageLightingConfig,
  StudioProfileData,
  TrackingTuning,
} from './types';
import { VRMCharacterRenderer } from './utils/vrmRenderer';
import {
  DEFAULT_TRACKING_TUNING,
  applyTrackingPipeline,
  captureCalibration,
  smoothPoseWithFactor,
  type AutoBlinkState,
  type PoseCalibration,
} from './utils/trackingFilters';
import { AVATAR_PRESETS, readAppearance, writeAppearance } from './character/avatarAppearance';
import {
  DEFAULT_PNG_AVATAR_CONFIG,
  drawPngAvatar,
  type PngAvatarSprites,
  type PngRenderState,
} from './character/pngAvatar';
import { drawStageBackdrop } from './utils/stageComposite';
import {
  MAX_PNG_BYTES,
  MAX_VRM_BYTES,
  clearPngAsset,
  clearVrmAsset,
  loadPngAsset,
  loadVrmAsset,
  savePngAsset,
  saveVrmAsset,
} from './utils/avatarStorage';
import { parseStudioUrlParams } from './utils/urlParams';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { WebcamPreview } from './components/WebcamPreview';
import { AvatarPanel } from './components/AvatarPanel';
import { StreamGuideModal } from './components/StreamGuideModal';
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  CubeIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  FlipHorizontalIcon,
  HelpCircleIcon,
  ImageIcon,
  KeyboardIcon,
  LayersIcon,
  MaximizeIcon,
  MicIcon,
  MicOffIcon,
  MinimizeIcon,
  PaletteIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PauseIcon,
  PlayIcon,
  PowerIcon,
  RecordIcon,
  RefreshIcon,
  RotateCcwIcon,
  SaveIcon,
  SlidersIcon,
  SmileIcon,
  SparklesIcon,
  StopSquareIcon,
  SunIcon,
  TargetIcon,
  TrashIcon,
  UploadIcon,
  VideoIcon,
  XIcon,
} from './components/Icons';
import { drawCharacter, drawHUD, drawOverlays } from './character/canvas2d';
import { CANVAS_SIZE } from './character/spec';

const VRM_MODEL_URL = './models/character.vrm';
/** Crisp 2× HD internal render backing resolution (logical coordinates stay 512×512). */
const STAGE_RENDER_SIZE = CANVAS_SIZE * 2;

type TabId = 'avatar' | 'expressions' | 'backgrounds' | 'overlays' | 'hotkeys' | 'settings';

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'avatar', label: 'Avatar', icon: <SparklesIcon size={15} /> },
  { id: 'expressions', label: 'Face', icon: <SmileIcon size={15} /> },
  { id: 'backgrounds', label: 'Stage', icon: <PaletteIcon size={15} /> },
  { id: 'overlays', label: 'Layers', icon: <LayersIcon size={15} /> },
  { id: 'hotkeys', label: 'Scenes', icon: <KeyboardIcon size={15} /> },
  { id: 'settings', label: 'Setup', icon: <SlidersIcon size={15} /> },
];

const EXPRESSION_CONTROLS: {
  key: keyof ExpressionState;
  label: string;
  hotkey?: string;
}[] = [
  { key: 'mouthOpen', label: 'Mouth Open', hotkey: '1' },
  { key: 'eyebrowRaise', label: 'Eyebrow Raise', hotkey: '2' },
  { key: 'eyeSmile', label: 'Eye Smile', hotkey: '3' },
  { key: 'cheekPuff', label: 'Cheek Blush', hotkey: '4' },
  { key: 'angry', label: 'Angry' },
  { key: 'sad', label: 'Sad' },
  { key: 'relaxed', label: 'Relaxed' },
];

const EXPRESSION_PRESETS: { name: string; values: ExpressionState }[] = [
  {
    name: 'Neutral',
    values: {
      mouthOpen: 0,
      eyebrowRaise: 0,
      eyeSmile: 0,
      cheekPuff: 0,
      angry: 0,
      sad: 0,
      relaxed: 0,
    },
  },
  {
    name: 'Happy',
    values: {
      mouthOpen: 0.45,
      eyebrowRaise: 0.25,
      eyeSmile: 1,
      cheekPuff: 0.6,
      angry: 0,
      sad: 0,
      relaxed: 0,
    },
  },
  {
    name: 'Surprised',
    values: {
      mouthOpen: 0.9,
      eyebrowRaise: 1,
      eyeSmile: 0,
      cheekPuff: 0.2,
      angry: 0,
      sad: 0,
      relaxed: 0,
    },
  },
  {
    name: 'Shy',
    values: {
      mouthOpen: 0.1,
      eyebrowRaise: 0.2,
      eyeSmile: 0.75,
      cheekPuff: 1,
      angry: 0,
      sad: 0,
      relaxed: 0.25,
    },
  },
  {
    name: 'Angry',
    values: {
      mouthOpen: 0.2,
      eyebrowRaise: 0,
      eyeSmile: 0,
      cheekPuff: 0.15,
      angry: 1,
      sad: 0,
      relaxed: 0,
    },
  },
  {
    name: 'Sad',
    values: {
      mouthOpen: 0,
      eyebrowRaise: 0,
      eyeSmile: 0,
      cheekPuff: 0.2,
      angry: 0,
      sad: 1,
      relaxed: 0.3,
    },
  },
];

interface BackgroundPreset {
  id: BackgroundType;
  label: string;
  group: 'broadcast' | 'studio';
  preview: string;
  value: string;
  checker?: boolean;
}

const BACKGROUND_PRESETS: BackgroundPreset[] = [
  {
    id: 'none',
    label: 'Transparent',
    group: 'broadcast',
    preview: 'transparent',
    value: 'transparent',
    checker: true,
  },
  {
    id: 'gradient',
    label: 'Chroma Green',
    group: 'broadcast',
    preview: '#00b140',
    value: '#00b140',
  },
  {
    id: 'gradient',
    label: 'Chroma Blue',
    group: 'broadcast',
    preview: '#0047bb',
    value: '#0047bb',
  },
  {
    id: 'blur',
    label: 'Dim Matte',
    group: 'broadcast',
    preview: '#0b0c12',
    value: 'rgba(8, 9, 13, 0.72)',
  },
  {
    id: 'gradient',
    label: 'Obsidian',
    group: 'studio',
    preview: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
    value: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
  },
  {
    id: 'gradient',
    label: 'Sakura Night',
    group: 'studio',
    preview: 'linear-gradient(135deg, #1b0f26 0%, #3b1947 52%, #111322 100%)',
    value: 'linear-gradient(135deg, #1b0f26 0%, #3b1947 52%, #111322 100%)',
  },
  {
    id: 'gradient',
    label: 'Aurora',
    group: 'studio',
    preview: 'linear-gradient(135deg, #0f3443 0%, #1f7a68 50%, #111a22 100%)',
    value: 'linear-gradient(135deg, #0f3443 0%, #1f7a68 50%, #111a22 100%)',
  },
  {
    id: 'gradient',
    label: 'Ocean',
    group: 'studio',
    preview: 'linear-gradient(135deg, #0b3d91 0%, #0ea5e9 55%, #091324 100%)',
    value: 'linear-gradient(135deg, #0b3d91 0%, #0ea5e9 55%, #091324 100%)',
  },
  {
    id: 'gradient',
    label: 'Twilight',
    group: 'studio',
    preview: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #180c2c 100%)',
    value: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #180c2c 100%)',
  },
  {
    id: 'gradient',
    label: 'Crimson',
    group: 'studio',
    preview: 'linear-gradient(135deg, #240718 0%, #881337 52%, #12090d 100%)',
    value: 'linear-gradient(135deg, #240718 0%, #881337 52%, #12090d 100%)',
  },
];

const QUICK_EMOJIS = ['🌸', '✨', '⭐', '💖', '🎀', '💫', '🔥', '🎵'];

const STUDIO_SHORTCUTS = [
  { key: 'C', label: 'Calibrate Center Pose' },
  { key: 'M', label: 'Mirror Avatar' },
  { key: 'V', label: 'Webcam Face Mesh PiP' },
  { key: 'Z', label: 'OBS Clean Mode' },
  { key: '`', label: 'Performance Telemetry' },
  { key: 'Esc', label: 'Exit Clean Mode' },
];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode image file.'));
    img.src = src;
  });
}

function ContributorsSection() {
  const { contributors, loading, error, fromCache } = useContributors();

  if (loading) {
    return (
      <div className="contributors-list">
        {Array.from({ length: FALLBACK_COUNT }, (_, i) => (
          <div key={i} className="contributor-row skeleton-row">
            <div className="skeleton-circle" />
            <div className="contributor-info">
              <div className="skeleton-line skeleton-line-sm" />
              <div className="skeleton-line skeleton-line-xs" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="contributors-list">
      {error && (
        <div className="contributor-fallback-hint" title={error}>
          <span className="contributors-badge">{fromCache ? 'CACHED' : 'OFFLINE'}</span>
        </div>
      )}
      {contributors.map((c) => (
        <a
          key={c.login}
          href={c.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="contributor-row"
        >
          <div className="contributor-avatar-wrapper">
            <img className="contributor-avatar" src={c.avatar_url} alt={c.name} loading="lazy" />
          </div>
          <div className="contributor-info">
            <span className="contributor-name">{c.name}</span>
            <span className="contributor-role">{c.role}</span>
          </div>
          {c.contributions > 0 && (
            <span className="contributor-contributions" title={`${c.contributions} contributions`}>
              {c.contributions}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

function App() {
  const [urlConfig] = useState(() =>
    parseStudioUrlParams(typeof window !== 'undefined' ? window.location.search : ''),
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vrmCanvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRendererRef = useRef<VRMCharacterRenderer | null>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const bgImageElRef = useRef<HTMLImageElement | null>(null);

  const vrmObjectUrlRef = useRef<string | null>(null);
  const pngBlobsRef = useRef<{
    name: string;
    idle: Blob | null;
    talking: Blob | null;
    blinking: Blob | null;
  }>({ name: '', idle: null, talking: null, blinking: null });
  const pngUrlsRef = useRef<{
    idle: string | null;
    talking: string | null;
    blinking: string | null;
  }>({ idle: null, talking: null, blinking: null });
  const pngSpritesRef = useRef<PngAvatarSprites>({ idle: null, talking: null, blinking: null });
  const pngRenderStateRef = useRef<PngRenderState>({ bounce: 0, talkPhase: 0 });
  const pngTargetSlotRef = useRef<'idle' | 'talking' | 'blinking'>('idle');

  const vrmInputRef = useRef<HTMLInputElement>(null);
  const pngInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const overlayImageInputRef = useRef<HTMLInputElement>(null);
  const profileImportRef = useRef<HTMLInputElement>(null);

  const initStarted = useRef(false);
  const animFrameRef = useRef(0);
  const smoothedPoseRef = useRef<PoseData | null>(null);
  const calibrationRef = useRef<PoseCalibration | null>(null);
  const blinkStateRef = useRef<AutoBlinkState>({ nextBlinkAtMs: 0, blinkStartMs: null });
  const prevHeadYawRef = useRef(0);
  const hairSwayRef = useRef(0);
  const dragPanRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('avatar');
  const [avatarMode, setAvatarMode] = useState<AvatarMode>('studio');
  const [appearance, setAppearance] = useState<AvatarAppearance>(() =>
    urlConfig.avatarPreset ? AVATAR_PRESETS[urlConfig.avatarPreset] : readAppearance(),
  );
  const [vrmModelName, setVrmModelName] = useState<string | null>(null);
  const [vrmError, setVrmError] = useState<string | null>(null);
  const [vrmPersisted, setVrmPersisted] = useState(false);

  const [pngConfig, setPngConfig] = useState<PngAvatarConfig>(DEFAULT_PNG_AVATAR_CONFIG);
  const [pngHasIdle, setPngHasIdle] = useState(false);
  const [pngHasTalking, setPngHasTalking] = useState(false);
  const [pngHasBlinking, setPngHasBlinking] = useState(false);
  const [pngError, setPngError] = useState<string | null>(null);

  const [newOverlayText, setNewOverlayText] = useState('');
  const [newProfileName, setNewProfileName] = useState('');
  const [profileNotice, setProfileNotice] = useState<string | null>(null);
  const [customColor, setCustomColor] = useState('#141828');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [cleanMode, setCleanMode] = useState(urlConfig.cleanMode);
  const [mirrored, setMirrored] = useState(urlConfig.mirrored ?? false);
  const [showChecker, setShowChecker] = useState(true);
  const [showWebcamPip, setShowWebcamPip] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggingAsset, setIsDraggingAsset] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [calibratedFlash, setCalibratedFlash] = useState(false);
  const [hasCalibration, setHasCalibration] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [dismissedError, setDismissedError] = useState<string | null>(null);
  const [rebindingAction, setRebindingAction] = useState<string | null>(null);

  const [cameraConfig, setCameraConfig] = useState<StageCameraConfig>(DEFAULT_STAGE_CAMERA);
  const [lightingConfig, setLightingConfig] = useState<StageLightingConfig>(
    LIGHTING_PRESETS.studio,
  );
  const [trackingTuning, setTrackingTuning] = useState<TrackingTuning>(DEFAULT_TRACKING_TUNING);

  const vtuber = useVtuber();
  const {
    loadModels,
    stopCamera,
    setMaxFps,
    poseRef,
    setExpression,
    setBackground,
    setOverlays,
    updateHotkey,
  } = vtuber;
  const { settings, updateSettings } = useSettings();
  const audioLipSync = useAudioLipSync();
  const stageRecorder = useStageRecorder();
  const popout = usePopoutStage(STAGE_RENDER_SIZE);
  const { pushFrame: popoutPushFrame } = popout;
  const { profiles, saveProfile, deleteProfile } = useProfiles();

  // Mirror state refs for the single persistent 60fps RAF loop
  const showDebugRef = useRef(settings.showDebug);
  useEffect(() => {
    showDebugRef.current = settings.showDebug;
  }, [settings.showDebug]);

  const avatarModeRef = useRef(avatarMode);
  useEffect(() => {
    avatarModeRef.current = avatarMode;
  }, [avatarMode]);

  const appearanceRef = useRef(appearance);
  useEffect(() => {
    appearanceRef.current = appearance;
    writeAppearance(appearance);
  }, [appearance]);

  const pngConfigRef = useRef(pngConfig);
  useEffect(() => {
    pngConfigRef.current = pngConfig;
  }, [pngConfig]);

  const mirroredRef = useRef(mirrored);
  useEffect(() => {
    mirroredRef.current = mirrored;
  }, [mirrored]);

  const cameraConfigRef = useRef(cameraConfig);
  useEffect(() => {
    cameraConfigRef.current = cameraConfig;
    vrmRendererRef.current?.setCameraConfig(cameraConfig);
  }, [cameraConfig]);

  useEffect(() => {
    vrmRendererRef.current?.setLighting(lightingConfig);
  }, [lightingConfig]);

  const trackingTuningRef = useRef(trackingTuning);
  useEffect(() => {
    trackingTuningRef.current = trackingTuning;
  }, [trackingTuning]);

  const backgroundRef = useRef(vtuber.background);
  const backgroundValueRef = useRef(vtuber.backgroundValue);
  useEffect(() => {
    backgroundRef.current = vtuber.background;
    backgroundValueRef.current = vtuber.backgroundValue;
    if (vtuber.background === 'image' && /^data:image\//i.test(vtuber.backgroundValue)) {
      const img = new Image();
      img.onload = () => {
        bgImageElRef.current = img;
      };
      img.src = vtuber.backgroundValue;
    } else {
      bgImageElRef.current = null;
    }
  }, [vtuber.background, vtuber.backgroundValue]);

  const recordingRef = useRef(stageRecorder.isRecording);
  useEffect(() => {
    recordingRef.current = stageRecorder.isRecording;
  }, [stageRecorder.isRecording]);

  const popoutOpenRef = useRef(popout.isOpen);
  useEffect(() => {
    popoutOpenRef.current = popout.isOpen;
  }, [popout.isOpen]);

  const isLoadedRef = useRef(vtuber.isLoaded);
  useEffect(() => {
    isLoadedRef.current = vtuber.isLoaded;
  }, [vtuber.isLoaded]);

  // Apply URL background shortcut on first mount if provided
  useEffect(() => {
    if (urlConfig.background) {
      setBackground(urlConfig.background.type, urlConfig.background.value);
    }
  }, [urlConfig.background, setBackground]);

  const startTracking = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDismissedError(null);
    void loadModels(video, {
      delegate: settings.delegate,
      deviceId: settings.deviceId ?? undefined,
    });
  }, [settings.delegate, settings.deviceId, loadModels]);

  useEffect(() => {
    if (!settings.autoStart || urlConfig.disableAutoCam || initStarted.current) return;
    initStarted.current = true;
    startTracking();
  }, [settings.autoStart, urlConfig.disableAutoCam, startTracking]);

  useEffect(() => {
    setMaxFps(settings.maxFps);
  }, [settings.maxFps, setMaxFps]);

  const restartWith = useCallback(
    (next: { delegate?: InferenceDelegate; deviceId?: string | null }) => {
      updateSettings(next);
      if (!vtuber.isLoaded) return;
      const video = videoRef.current;
      if (!video) return;
      const delegate = next.delegate ?? settings.delegate;
      const deviceId = next.deviceId === undefined ? settings.deviceId : next.deviceId;
      void loadModels(video, { delegate, deviceId: deviceId ?? undefined });
    },
    [settings.delegate, settings.deviceId, updateSettings, vtuber.isLoaded, loadModels],
  );

  // Helper to apply PNG blobs into runtime image elements
  const loadPngSpriteBlob = useCallback(
    async (slot: 'idle' | 'talking' | 'blinking', blob: Blob): Promise<boolean> => {
      const nextUrl = URL.createObjectURL(blob);
      try {
        const img = await loadImageElement(nextUrl);
        const prevUrl = pngUrlsRef.current[slot];
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        pngUrlsRef.current[slot] = nextUrl;
        pngSpritesRef.current[slot] = img;
        pngBlobsRef.current[slot] = blob;
        if (slot === 'idle') setPngHasIdle(true);
        if (slot === 'talking') setPngHasTalking(true);
        if (slot === 'blinking') setPngHasBlinking(true);
        return true;
      } catch {
        URL.revokeObjectURL(nextUrl);
        return false;
      }
    },
    [],
  );

  // Initialize VRM 3D renderer at crisp 1024×1024 HD + restore local IndexedDB assets
  useEffect(() => {
    const vrmCanvas = vrmCanvasRef.current;
    if (!vrmCanvas) return;
    vrmCanvas.width = STAGE_RENDER_SIZE;
    vrmCanvas.height = STAGE_RENDER_SIZE;
    const pngUrlBucket = pngUrlsRef.current;
    let cancelled = false;

    const renderer = new VRMCharacterRenderer(vrmCanvas);
    vrmRendererRef.current = renderer;
    renderer.setLighting(LIGHTING_PRESETS.studio);

    void (async () => {
      // 1. Restore any saved PNGTuber sprites from IndexedDB
      const savedPng = await loadPngAsset();
      if (!cancelled && savedPng) {
        const idleOk = await loadPngSpriteBlob('idle', savedPng.idle);
        if (idleOk && !cancelled) {
          pngBlobsRef.current.name = savedPng.name;
          setPngConfig((prev) => ({ ...prev, name: savedPng.name }));
          if (savedPng.talking) await loadPngSpriteBlob('talking', savedPng.talking);
          if (savedPng.blinking) await loadPngSpriteBlob('blinking', savedPng.blinking);
        }
      }

      // 2. Restore saved user .vrm from IndexedDB, else probe bundled ./models/character.vrm
      const savedVrm = await loadVrmAsset();
      if (!cancelled && savedVrm) {
        const blobUrl = URL.createObjectURL(savedVrm.blob);
        const ok = await renderer.loadModel(blobUrl);
        if (cancelled) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        if (ok) {
          vrmObjectUrlRef.current = blobUrl;
          renderer.setCameraConfig(cameraConfigRef.current);
          setVrmModelName(savedVrm.name);
          setVrmPersisted(true);
          setAvatarMode('vrm');
          return;
        }
        URL.revokeObjectURL(blobUrl);
      }

      if (!cancelled) {
        const ok = await renderer.loadModel(VRM_MODEL_URL);
        if (!cancelled && ok) {
          setVrmModelName('character.vrm');
          setAvatarMode('vrm');
        } else if (!cancelled && savedPng && pngSpritesRef.current.idle) {
          setAvatarMode('png');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (vrmObjectUrlRef.current) {
        URL.revokeObjectURL(vrmObjectUrlRef.current);
        vrmObjectUrlRef.current = null;
      }
      if (pngUrlBucket.idle) URL.revokeObjectURL(pngUrlBucket.idle);
      if (pngUrlBucket.talking) URL.revokeObjectURL(pngUrlBucket.talking);
      if (pngUrlBucket.blinking) URL.revokeObjectURL(pngUrlBucket.blinking);
      vrmRendererRef.current?.destroy();
      vrmRendererRef.current = null;
    };
  }, [loadPngSpriteBlob]);

  const handleVrmUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      setVrmError('Please select a .vrm avatar file.');
      return;
    }
    if (file.size > MAX_VRM_BYTES) {
      setVrmError('VRM file exceeds 150 MB browser storage limit.');
      return;
    }
    const renderer = vrmRendererRef.current;
    if (!renderer) {
      setVrmError('VRM WebGL 3D renderer is unavailable in this browser.');
      return;
    }
    setVrmError(null);
    const nextUrl = URL.createObjectURL(file);
    const ok = await renderer.loadModel(nextUrl);
    if (ok) {
      if (vrmObjectUrlRef.current) {
        URL.revokeObjectURL(vrmObjectUrlRef.current);
      }
      vrmObjectUrlRef.current = nextUrl;
      renderer.setCameraConfig(cameraConfigRef.current);
      setVrmModelName(file.name);
      setAvatarMode('vrm');
      const persisted = await saveVrmAsset(file.name, file);
      setVrmPersisted(persisted);
    } else {
      URL.revokeObjectURL(nextUrl);
      const detail = renderer.getLastError();
      setVrmError(
        `Could not load "${file.name}"${detail ? `: ${detail}` : '. Ensure it is a valid VRM 0.x/1.0 model.'}`,
      );
    }
  }, []);

  const handleVrmReset = useCallback(() => {
    if (vrmObjectUrlRef.current) {
      URL.revokeObjectURL(vrmObjectUrlRef.current);
      vrmObjectUrlRef.current = null;
    }
    vrmRendererRef.current?.unloadModel();
    setVrmModelName(null);
    setVrmError(null);
    setVrmPersisted(false);
    void clearVrmAsset();
    setAvatarMode(pngSpritesRef.current.idle ? 'png' : 'studio');
  }, []);

  const handlePngUpload = useCallback(
    async (slot: 'idle' | 'talking' | 'blinking', file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        setPngError('Please select a PNG, WebP, or JPG image file.');
        return;
      }
      if (file.size > MAX_PNG_BYTES) {
        setPngError('Image exceeds 15 MB limit.');
        return;
      }
      setPngError(null);
      const ok = await loadPngSpriteBlob(slot, file);
      if (!ok) {
        setPngError(`Could not decode "${file.name}".`);
        return;
      }
      if (slot === 'idle') {
        const cleanName = file.name.replace(/\.[^.]+$/, '');
        pngBlobsRef.current.name = cleanName;
        setPngConfig((prev) => ({ ...prev, name: cleanName }));
        setAvatarMode('png');
      }
      const blobs = pngBlobsRef.current;
      if (blobs.idle) {
        void savePngAsset({
          name: blobs.name || 'Custom PNG',
          idle: blobs.idle,
          talking: blobs.talking,
          blinking: blobs.blinking,
        });
      }
    },
    [loadPngSpriteBlob],
  );

  const handleClearPngSlot = useCallback((slot: 'idle' | 'talking' | 'blinking') => {
    if (slot === 'idle') {
      for (const key of ['idle', 'talking', 'blinking'] as const) {
        const url = pngUrlsRef.current[key];
        if (url) URL.revokeObjectURL(url);
        pngUrlsRef.current[key] = null;
        pngSpritesRef.current[key] = null;
        pngBlobsRef.current[key] = null;
      }
      pngBlobsRef.current.name = '';
      setPngHasIdle(false);
      setPngHasTalking(false);
      setPngHasBlinking(false);
      setPngConfig((prev) => ({ ...prev, name: '' }));
      void clearPngAsset();
      setAvatarMode(vrmRendererRef.current?.isReady() ? 'vrm' : 'studio');
      return;
    }
    const url = pngUrlsRef.current[slot];
    if (url) URL.revokeObjectURL(url);
    pngUrlsRef.current[slot] = null;
    pngSpritesRef.current[slot] = null;
    pngBlobsRef.current[slot] = null;
    if (slot === 'talking') setPngHasTalking(false);
    if (slot === 'blinking') setPngHasBlinking(false);
    const blobs = pngBlobsRef.current;
    if (blobs.idle) {
      void savePngAsset({
        name: blobs.name || 'Custom PNG',
        idle: blobs.idle,
        talking: blobs.talking,
        blinking: blobs.blinking,
      });
    }
  }, []);

  const handleCalibrate = useCallback(() => {
    const raw = poseRef.current;
    if (raw) {
      calibrationRef.current = captureCalibration(raw);
    }
    vrmRendererRef.current?.calibrateHead();
    setHasCalibration(true);
    setCalibratedFlash(true);
    window.setTimeout(() => setCalibratedFlash(false), 1500);
  }, [poseRef]);

  const handleResetCalibration = useCallback(() => {
    calibrationRef.current = null;
    vrmRendererRef.current?.resetCalibration();
    setHasCalibration(false);
  }, []);

  // Ensure offscreen 1024×1024 composite canvas exists and draws backdrop + live stage
  const renderCompositeFrame = useCallback((): HTMLCanvasElement | null => {
    const stage = overlayCanvasRef.current;
    if (!stage) return null;
    let comp = compositeCanvasRef.current;
    if (!comp) {
      comp = document.createElement('canvas');
      comp.width = STAGE_RENDER_SIZE;
      comp.height = STAGE_RENDER_SIZE;
      compositeCanvasRef.current = comp;
    }
    const ctx = comp.getContext('2d');
    if (!ctx) return null;
    drawStageBackdrop(
      ctx,
      STAGE_RENDER_SIZE,
      STAGE_RENDER_SIZE,
      backgroundRef.current,
      backgroundValueRef.current,
      bgImageElRef.current,
    );
    ctx.drawImage(stage, 0, 0, STAGE_RENDER_SIZE, STAGE_RENDER_SIZE);
    return comp;
  }, []);

  const handleSnapshot = useCallback(() => {
    const comp = renderCompositeFrame();
    if (!comp) return;
    const link = document.createElement('a');
    link.download = `easyvtuber-${Date.now()}.png`;
    link.href = comp.toDataURL('image/png');
    link.click();
    setSnapshotSaved(true);
    window.setTimeout(() => setSnapshotSaved(false), 1800);
  }, [renderCompositeFrame]);

  const handleToggleRecording = useCallback(() => {
    if (stageRecorder.isRecording) {
      stageRecorder.stopRecording();
      return;
    }
    const comp = renderCompositeFrame();
    stageRecorder.startRecording(comp, audioLipSync.streamRef.current);
  }, [stageRecorder, renderCompositeFrame, audioLipSync.streamRef]);

  const toggleFullscreen = useCallback(() => {
    const el = stageContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Interactive hotkey rebinding listener
  useEffect(() => {
    if (!rebindingAction) return;
    const onCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') {
        setRebindingAction(null);
        return;
      }
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      updateHotkey(rebindingAction, e.key);
      setRebindingAction(null);
    };
    window.addEventListener('keydown', onCapture, true);
    return () => window.removeEventListener('keydown', onCapture, true);
  }, [rebindingAction, updateHotkey]);

  // Studio-level keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (rebindingAction || guideOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        handleCalibrate();
      } else if (key === 'm') {
        e.preventDefault();
        setMirrored((v) => !v);
      } else if (key === 'v') {
        e.preventDefault();
        setShowWebcamPip((v) => !v);
      } else if (key === 'z') {
        e.preventDefault();
        setCleanMode((v) => !v);
      } else if (e.key === 'Escape') {
        setCleanMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleCalibrate, rebindingAction, guideOpen]);

  // Direct stage zoom (wheel) & drag pan
  const handleStageWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setCameraConfig((prev) => ({
      ...prev,
      zoom: Number(Math.max(0.5, Math.min(2.5, prev.zoom + delta)).toFixed(2)),
    }));
  }, []);

  const handleStagePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button, input, .perf-monitor, .webcam-pip, .stage-toast')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPanRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: cameraConfigRef.current.offsetX,
      origY: cameraConfigRef.current.offsetY,
    };
  }, []);

  const handleStagePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const pan = dragPanRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - pan.startX) / Math.max(rect.width, 1);
    const dy = (e.clientY - pan.startY) / Math.max(rect.height, 1);
    setCameraConfig((prev) => ({
      ...prev,
      offsetX: Number(Math.max(-0.4, Math.min(0.4, pan.origX + dx)).toFixed(3)),
      offsetY: Number(Math.max(-0.4, Math.min(0.4, pan.origY + dy)).toFixed(3)),
    }));
  }, []);

  const handleStagePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (dragPanRef.current?.pointerId === e.pointerId) {
      dragPanRef.current = null;
    }
  }, []);

  const handleStageDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingAsset(true);
  }, []);

  const handleStageDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDraggingAsset(false);
  }, []);

  const handleStageDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingAsset(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (file.name.toLowerCase().endsWith('.vrm')) {
        void handleVrmUpload(file);
      } else if (file.type.startsWith('image/')) {
        void handlePngUpload('idle', file);
      } else {
        setVrmError('Drop a .vrm 3D model or a .png / .webp 2D avatar image.');
      }
    },
    [handleVrmUpload, handlePngUpload],
  );

  // Persistent crisp 1024×1024 HD RAF render loop
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = STAGE_RENDER_SIZE;
    canvas.height = STAGE_RENDER_SIZE;
    const scaleFactor = STAGE_RENDER_SIZE / CANVAS_SIZE;

    let running = true;
    const render = () => {
      if (!running) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, STAGE_RENDER_SIZE, STAGE_RENDER_SIZE);
      ctx.setTransform(scaleFactor, 0, 0, scaleFactor, 0, 0);

      const nowMs = performance.now();
      const tuning = trackingTuningRef.current;
      const audioMouth = audioLipSync.levelRef.current;
      const rawPose = vtuber.trackingRef.current ? vtuber.poseRef.current : null;
      const calibratedPose = applyTrackingPipeline(
        rawPose,
        calibrationRef.current,
        tuning,
        audioMouth,
        nowMs,
        blinkStateRef.current,
      );
      smoothedPoseRef.current = smoothPoseWithFactor(
        calibratedPose,
        smoothedPoseRef.current,
        tuning.smoothing,
      );
      const currentPose = smoothedPoseRef.current;
      const currentOverlays = vtuber.overlaysRef.current;
      const isTracking = vtuber.trackingRef.current;
      const expression = vtuber.expressionRef.current;
      const cam = cameraConfigRef.current;

      // Smooth spring-damped hair physics sway from head yaw velocity + roll
      const yawNow = currentPose?.yAngle ?? 0;
      const yawVel = yawNow - prevHeadYawRef.current;
      prevHeadYawRef.current = yawNow;
      const targetSway = Math.max(-1, Math.min(1, -yawVel * 9 - (currentPose?.zAngle ?? 0) * 0.65));
      hairSwayRef.current = hairSwayRef.current * 0.84 + targetSway * 0.16;

      // Draw ONLY the avatar layer mirrored when Mirror is enabled so text overlays stay readable
      ctx.save();
      if (mirroredRef.current) {
        ctx.translate(CANVAS_SIZE, 0);
        ctx.scale(-1, 1);
      }

      const mode = avatarModeRef.current;
      const vrmRenderer = vrmRendererRef.current;
      const vrmDrawn =
        mode === 'vrm' && vrmRenderer?.isReady()
          ? vrmRenderer.render(
              isTracking ? vtuber.landmarksRef.current : null,
              expression,
              tuning,
              audioMouth,
            )
          : false;

      if (vrmDrawn && vrmCanvasRef.current) {
        ctx.drawImage(vrmCanvasRef.current, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      } else {
        ctx.save();
        ctx.translate(
          CANVAS_SIZE / 2 + cam.offsetX * CANVAS_SIZE,
          CANVAS_SIZE / 2 + cam.offsetY * CANVAS_SIZE,
        );
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-CANVAS_SIZE / 2, -CANVAS_SIZE / 2);

        const pngDrawn =
          mode === 'png'
            ? drawPngAvatar(
                ctx,
                pngSpritesRef.current,
                currentPose,
                expression,
                audioMouth,
                pngConfigRef.current,
                pngRenderStateRef.current,
                nowMs,
              )
            : false;

        if (!pngDrawn) {
          drawCharacter(ctx, currentPose, expression, appearanceRef.current, hairSwayRef.current);
        }
        ctx.restore();
      }
      ctx.restore();

      // Overlays & Debug HUD always render crisp and un-mirrored
      drawOverlays(ctx, currentOverlays);
      if (showDebugRef.current && isLoadedRef.current) {
        drawHUD(ctx, currentPose, isTracking);
      } else if (!isTracking && isLoadedRef.current) {
        drawHUD(ctx, null, false);
      }

      // Composite backdrop + stage when recording WebM clips or streaming to OBS Pop-Out Window
      if (recordingRef.current || popoutOpenRef.current) {
        const comp = renderCompositeFrame();
        if (comp && popoutOpenRef.current) {
          const bgCss =
            backgroundRef.current === 'none' || backgroundRef.current === 'image'
              ? '#000000'
              : backgroundValueRef.current;
          popoutPushFrame(comp, bgCss);
        }
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
    // refs & callbacks are stable — single persistent loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderCompositeFrame, popoutPushFrame]);

  const addTextOverlay = useCallback(() => {
    const text = newOverlayText.trim();
    if (!text) return;
    vtuber.addOverlay({
      id: `overlay-${Date.now()}`,
      type: 'text',
      content: text,
      x: 0.5,
      y: 0.88,
      scale: 1,
      rotation: 0,
      opacity: 0.95,
    });
    setNewOverlayText('');
  }, [newOverlayText, vtuber]);

  const applyStudioProfile = useCallback(
    (data: StudioProfileData) => {
      setExpression(data.expression);
      setBackground(data.background, data.backgroundValue);
      setOverlays(data.overlays);
      setCameraConfig(data.camera);
      setLightingConfig(data.lighting);
      setTrackingTuning(data.tuning);
      setMirrored(data.mirrored);
      if (data.appearance) {
        setAppearance(data.appearance);
      }
    },
    [setExpression, setBackground, setOverlays],
  );

  const handleSaveProfile = useCallback(() => {
    const name = newProfileName.trim() || `Scene ${profiles.length + 1}`;
    saveProfile(name, {
      expression: vtuber.expression,
      background: vtuber.background,
      backgroundValue: vtuber.backgroundValue,
      overlays: vtuber.overlays,
      camera: cameraConfig,
      lighting: lightingConfig,
      tuning: trackingTuning,
      mirrored,
      appearance,
    });
    setNewProfileName('');
    setProfileNotice(`Saved "${name}"`);
    window.setTimeout(() => setProfileNotice(null), 2200);
  }, [
    newProfileName,
    profiles.length,
    saveProfile,
    vtuber.expression,
    vtuber.background,
    vtuber.backgroundValue,
    vtuber.overlays,
    cameraConfig,
    lightingConfig,
    trackingTuning,
    mirrored,
    appearance,
  ]);

  const handleExportProfile = useCallback((name: string, data: unknown) => {
    const blob = new Blob([JSON.stringify({ name, data }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') || 'profile'}.easyvtuber.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, []);

  const isImageBg = vtuber.background === 'image' && /^data:image\//i.test(vtuber.backgroundValue);
  const backgroundStyle =
    vtuber.background === 'none' || isImageBg ? 'transparent' : vtuber.backgroundValue;
  const showTransparentGrid = vtuber.background === 'none' && showChecker && !cleanMode;
  const cameraBooting = !vtuber.isLoaded && vtuber.progress > 0 && vtuber.progress < 100;
  const visibleCameraError = vtuber.error && vtuber.error !== dismissedError ? vtuber.error : null;

  const activeRendererLabel =
    avatarMode === 'vrm' && vrmModelName
      ? 'VRM 3D HD'
      : avatarMode === 'png' && pngHasIdle
        ? 'PNGTuber HD'
        : 'Studio 2D HD';

  const activeAvatarTitle =
    avatarMode === 'vrm' && vrmModelName
      ? vrmModelName
      : avatarMode === 'png' && pngHasIdle
        ? pngConfig.name || 'PNG Avatar'
        : `${appearance.presetId[0]!.toUpperCase() + appearance.presetId.slice(1)} Rig`;

  const statusTone = visibleCameraError
    ? 'paused'
    : vtuber.isLoaded
      ? vtuber.isTracking
        ? 'online'
        : 'paused'
      : audioLipSync.enabled
        ? 'online'
        : 'offline';

  return (
    <div className={`app ${cleanMode ? 'clean-mode' : ''}`}>
      {/* Hidden File Inputs */}
      <input
        ref={vrmInputRef}
        type="file"
        accept=".vrm"
        className="sr-only-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void handleVrmUpload(file);
        }}
      />
      <input
        ref={pngInputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg,image/gif"
        className="sr-only-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          void handlePngUpload(pngTargetSlotRef.current, file);
        }}
      />
      <input
        ref={bgImageInputRef}
        type="file"
        accept="image/*"
        className="sr-only-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string' && /^data:image\//i.test(reader.result)) {
              vtuber.setBackground('image', reader.result);
            }
          };
          reader.readAsDataURL(file);
        }}
      />
      <input
        ref={profileImportRef}
        type="file"
        accept="application/json,.json"
        className="sr-only-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          void file.text().then((text) => {
            try {
              const imported = parseProfileJson(text);
              saveProfile(imported.name, imported.data);
              applyStudioProfile(imported.data);
              setProfileNotice(`Imported "${imported.name}"`);
              window.setTimeout(() => setProfileNotice(null), 2500);
            } catch (err) {
              setProfileNotice(err instanceof Error ? err.message : 'Invalid profile JSON');
            }
          });
        }}
      />

      {/* OBS & Discord Stream Setup Guide Modal */}
      <StreamGuideModal
        open={guideOpen}
        mirrored={mirrored}
        avatarPreset={appearance.presetId}
        onClose={() => setGuideOpen(false)}
        onOpenPopout={popout.openPopout}
      />

      {/* Top Studio Bar */}
      {!cleanMode && (
        <header className="header">
          <div className="header-left">
            <button
              type="button"
              className={`icon-btn ${leftOpen ? 'active' : ''}`}
              onClick={() => setLeftOpen((v) => !v)}
              aria-label="Toggle Control Panel"
              title="Toggle Control Panel"
            >
              <PanelLeftIcon size={16} />
            </button>
            <div className="brand-mark" aria-hidden="true">
              EV
            </div>
            <div className="brand-text">
              <span className="logo-text">EasyVtuber</span>
              <span className="logo-badge">Studio</span>
            </div>
            <span className="renderer-chip" title="Active rendering backend">
              <CubeIcon size={12} />
              {activeRendererLabel}
            </span>
          </div>

          <div className="header-center">
            <div className="status-pill" role="status" aria-live="polite">
              <span className={`status-indicator ${statusTone}`} />
              <span className="status-text">
                {vtuber.isLoaded
                  ? vtuber.isTracking
                    ? `Tracking Live (${vtuber.delegate})`
                    : 'Tracking Paused'
                  : cameraBooting
                    ? vtuber.status
                    : audioLipSync.enabled
                      ? 'Mic Lip-Sync Live'
                      : 'Stage Ready'}
              </span>
            </div>
            {vtuber.isLoaded ? (
              <>
                <button
                  type="button"
                  className={`header-action-btn ${vtuber.isTracking ? '' : 'paused'}`}
                  onClick={vtuber.toggleTracking}
                >
                  {vtuber.isTracking ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
                  <span>{vtuber.isTracking ? 'Pause' : 'Resume'}</span>
                </button>
                <button
                  type="button"
                  className="icon-btn danger-hover"
                  onClick={stopCamera}
                  aria-label="Turn off camera"
                  title="Turn off webcam hardware (Privacy Off)"
                >
                  <PowerIcon size={15} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="header-action-btn primary"
                disabled={cameraBooting}
                onClick={startTracking}
              >
                <PlayIcon size={13} />
                <span>{cameraBooting ? 'Starting...' : 'Start Camera'}</span>
              </button>
            )}
            {stageRecorder.isRecording && (
              <button
                type="button"
                className="rec-pill"
                onClick={stageRecorder.stopRecording}
                title="Stop recording and save WebM clip"
              >
                <span className="rec-dot" />
                <span>REC {formatDuration(stageRecorder.durationSec)}</span>
              </button>
            )}
          </div>

          <div className="header-right">
            <div className="telemetry-pill" aria-label="Live performance metrics">
              <div className="metric">
                <span className="metric-val">{vtuber.fps}</span>
                <span className="metric-unit">FPS</span>
              </div>
              <span className="metric-sep" aria-hidden="true" />
              <div className="metric">
                <span className="metric-val">{vtuber.inferenceTime}</span>
                <span className="metric-unit">ms</span>
              </div>
            </div>

            <button
              type="button"
              className="header-action-btn"
              onClick={() => setGuideOpen(true)}
              title="OBS Studio, Twitch, YouTube & Discord setup guide"
            >
              <HelpCircleIcon size={14} />
              <span className="hide-sm">OBS Guide</span>
            </button>

            <button
              type="button"
              className={`icon-btn ${rightOpen ? 'active' : ''}`}
              onClick={() => setRightOpen((v) => !v)}
              aria-label="Toggle Inspector Panel"
              title="Toggle Inspector Panel"
            >
              <PanelRightIcon size={16} />
            </button>
          </div>
        </header>
      )}

      <div className="main-layout">
        {/* Left Control Dock */}
        {!cleanMode && leftOpen && (
          <aside className="left-panel" aria-label="Studio Controls">
            <div className="tab-nav" role="tablist" aria-label="Control categories">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span className="tab-label">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="tab-content">
              {/* TAB 1: Avatar Studio (Built-in Customizer, PNGTuber 2D, VRM 3D) */}
              {activeTab === 'avatar' && (
                <AvatarPanel
                  avatarMode={avatarMode}
                  onSelectMode={setAvatarMode}
                  appearance={appearance}
                  onChangeAppearance={setAppearance}
                  vrmModelName={vrmModelName}
                  vrmError={vrmError}
                  vrmPersisted={vrmPersisted}
                  onBrowseVrm={() => vrmInputRef.current?.click()}
                  onResetVrm={handleVrmReset}
                  pngConfig={pngConfig}
                  pngHasIdle={pngHasIdle}
                  pngHasTalking={pngHasTalking}
                  pngHasBlinking={pngHasBlinking}
                  pngError={pngError}
                  onBrowsePngSlot={(slot) => {
                    pngTargetSlotRef.current = slot;
                    pngInputRef.current?.click();
                  }}
                  onClearPngSlot={handleClearPngSlot}
                  onChangePngConfig={(patch) => setPngConfig((prev) => ({ ...prev, ...patch }))}
                />
              )}

              {/* TAB 2: Face Expressions & Voice Lip-Sync */}
              {activeTab === 'expressions' && (
                <div className="panel">
                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Voice Lip-Sync (Mic)</h3>
                      <button
                        type="button"
                        className={`mini-toggle ${audioLipSync.enabled ? 'on' : ''}`}
                        onClick={audioLipSync.toggle}
                      >
                        {audioLipSync.enabled ? 'LIVE' : 'OFF'}
                      </button>
                    </div>
                    <div className="mic-card">
                      <div className="mic-meter-row">
                        <button
                          type="button"
                          className={`icon-btn ${audioLipSync.enabled ? 'active' : ''}`}
                          onClick={audioLipSync.toggle}
                          aria-label={
                            audioLipSync.enabled ? 'Disable mic lip-sync' : 'Enable mic lip-sync'
                          }
                        >
                          {audioLipSync.enabled ? <MicIcon size={15} /> : <MicOffIcon size={15} />}
                        </button>
                        <div className="vu-track" aria-label="Microphone level">
                          <div
                            className="vu-fill"
                            style={{ width: `${Math.round(audioLipSync.level * 100)}%` }}
                          />
                        </div>
                        <span className="expr-pct">{Math.round(audioLipSync.level * 100)}%</span>
                      </div>
                      <div className="overlay-controls-grid">
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Gain</span>
                            <span>{audioLipSync.sensitivity.toFixed(1)}×</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="0.5"
                            max="6"
                            step="0.1"
                            value={audioLipSync.sensitivity}
                            style={
                              {
                                '--range-pct': `${((audioLipSync.sensitivity - 0.5) / 5.5) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              audioLipSync.setSensitivity(parseFloat(e.target.value))
                            }
                          />
                        </label>
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Gate</span>
                            <span>{Math.round(audioLipSync.noiseGate * 100)}%</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="0"
                            max="0.15"
                            step="0.005"
                            value={audioLipSync.noiseGate}
                            style={
                              {
                                '--range-pct': `${(audioLipSync.noiseGate / 0.15) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) => audioLipSync.setNoiseGate(parseFloat(e.target.value))}
                          />
                        </label>
                      </div>
                      {audioLipSync.error && <p className="vrm-error-text">{audioLipSync.error}</p>}
                    </div>
                  </div>

                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Emotion Presets</h3>
                      <button
                        type="button"
                        className="link-action"
                        onClick={vtuber.resetExpression}
                      >
                        <RotateCcwIcon size={12} />
                        Reset
                      </button>
                    </div>
                    <div className="preset-grid cols-3">
                      {EXPRESSION_PRESETS.map((preset) => {
                        const isMatch = EXPRESSION_CONTROLS.every(
                          (c) =>
                            Math.abs(
                              (vtuber.expression[c.key] ?? 0) - (preset.values[c.key] ?? 0),
                            ) < 0.05,
                        );
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            className={`preset-chip ${isMatch ? 'active' : ''}`}
                            onClick={() => vtuber.setExpression(preset.values)}
                          >
                            {preset.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Expression Mix</h3>
                      <span className="section-hint">Keys 1–4</span>
                    </div>
                    <div className="expression-list">
                      {EXPRESSION_CONTROLS.map((expr) => {
                        const val = vtuber.expression[expr.key] ?? 0;
                        const isActive = val > 0.05;
                        return (
                          <div key={expr.key} className={`expr-card ${isActive ? 'active' : ''}`}>
                            <div className="expr-card-top">
                              <div className="expr-meta">
                                {expr.hotkey && <kbd className="mini-kbd">{expr.hotkey}</kbd>}
                                <span className="expr-label">{expr.label}</span>
                              </div>
                              <div className="expr-actions">
                                <span className="expr-pct">{Math.round(val * 100)}%</span>
                                <button
                                  type="button"
                                  className={`mini-toggle ${val > 0.5 ? 'on' : ''}`}
                                  onClick={() =>
                                    vtuber.setExpression({ [expr.key]: val > 0.5 ? 0 : 1 })
                                  }
                                >
                                  {val > 0.5 ? 'ON' : 'OFF'}
                                </button>
                              </div>
                            </div>
                            <input
                              type="range"
                              className="studio-range"
                              min="0"
                              max="1"
                              step="0.05"
                              aria-label={expr.label}
                              value={val}
                              style={{ '--range-pct': `${val * 100}%` } as React.CSSProperties}
                              onChange={(e) =>
                                vtuber.setExpression({ [expr.key]: parseFloat(e.target.value) })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Stage Camera, Lighting & Backdrops */}
              {activeTab === 'backgrounds' && (
                <div className="panel">
                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Camera Framing</h3>
                      <button
                        type="button"
                        className="link-action"
                        onClick={() => setCameraConfig(DEFAULT_STAGE_CAMERA)}
                      >
                        <RotateCcwIcon size={12} />
                        Center
                      </button>
                    </div>
                    <div className="card-box">
                      <div className="overlay-controls-grid">
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Zoom</span>
                            <span>{cameraConfig.zoom.toFixed(2)}×</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="0.5"
                            max="2.5"
                            step="0.05"
                            value={cameraConfig.zoom}
                            style={
                              {
                                '--range-pct': `${((cameraConfig.zoom - 0.5) / 2) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setCameraConfig((prev) => ({
                                ...prev,
                                zoom: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>3D Orbit</span>
                            <span>{cameraConfig.orbitYaw}°</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="-45"
                            max="45"
                            step="1"
                            value={cameraConfig.orbitYaw}
                            style={
                              {
                                '--range-pct': `${((cameraConfig.orbitYaw + 45) / 90) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setCameraConfig((prev) => ({
                                ...prev,
                                orbitYaw: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Pan X</span>
                            <span>{Math.round(cameraConfig.offsetX * 100)}%</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="-0.4"
                            max="0.4"
                            step="0.02"
                            value={cameraConfig.offsetX}
                            style={
                              {
                                '--range-pct': `${((cameraConfig.offsetX + 0.4) / 0.8) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setCameraConfig((prev) => ({
                                ...prev,
                                offsetX: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Pan Y</span>
                            <span>{Math.round(cameraConfig.offsetY * 100)}%</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="-0.4"
                            max="0.4"
                            step="0.02"
                            value={cameraConfig.offsetY}
                            style={
                              {
                                '--range-pct': `${((cameraConfig.offsetY + 0.4) / 0.8) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setCameraConfig((prev) => ({
                                ...prev,
                                offsetY: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                      <p className="panel-hint">
                        Scroll on stage to zoom, drag to pan, double-click to recenter.
                      </p>
                    </div>
                  </div>

                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">
                        <SunIcon size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
                        3D Studio Lighting
                      </h3>
                    </div>
                    <div className="preset-grid">
                      {(['studio', 'neon', 'sunset', 'moonlight'] as const).map((presetKey) => (
                        <button
                          key={presetKey}
                          type="button"
                          className={`preset-chip ${lightingConfig.preset === presetKey ? 'active' : ''}`}
                          onClick={() => setLightingConfig(LIGHTING_PRESETS[presetKey])}
                        >
                          {presetKey[0]!.toUpperCase() + presetKey.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="card-box">
                      <div className="overlay-controls-grid">
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Key Light</span>
                            <span>{lightingConfig.keyIntensity.toFixed(1)}</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="0"
                            max="2.5"
                            step="0.1"
                            value={lightingConfig.keyIntensity}
                            style={
                              {
                                '--range-pct': `${(lightingConfig.keyIntensity / 2.5) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setLightingConfig((prev) => ({
                                ...prev,
                                keyIntensity: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Rim Light</span>
                            <span>{lightingConfig.rimIntensity.toFixed(1)}</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="0"
                            max="2.5"
                            step="0.1"
                            value={lightingConfig.rimIntensity}
                            style={
                              {
                                '--range-pct': `${(lightingConfig.rimIntensity / 2.5) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setLightingConfig((prev) => ({
                                ...prev,
                                rimIntensity: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="panel-section">
                    <h3 className="panel-title">Broadcast &amp; Keying</h3>
                    <div className="background-grid">
                      {BACKGROUND_PRESETS.filter((b) => b.group === 'broadcast').map((bg) => (
                        <button
                          key={bg.label}
                          type="button"
                          className={`bg-btn ${
                            vtuber.background === bg.id && vtuber.backgroundValue === bg.value
                              ? 'active'
                              : ''
                          }`}
                          onClick={() => vtuber.setBackground(bg.id, bg.value)}
                        >
                          <div
                            className={`bg-preview ${bg.checker ? 'checker-surface' : ''}`}
                            style={bg.checker ? undefined : { background: bg.preview }}
                          />
                          <span className="bg-label">{bg.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="panel-section">
                    <h3 className="panel-title">Studio Gradients</h3>
                    <div className="background-grid">
                      {BACKGROUND_PRESETS.filter((b) => b.group === 'studio').map((bg) => (
                        <button
                          key={bg.label}
                          type="button"
                          className={`bg-btn ${
                            vtuber.background === bg.id && vtuber.backgroundValue === bg.value
                              ? 'active'
                              : ''
                          }`}
                          onClick={() => vtuber.setBackground(bg.id, bg.value)}
                        >
                          <div className="bg-preview" style={{ background: bg.preview }} />
                          <span className="bg-label">{bg.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="panel-section">
                    <h3 className="panel-title">Custom Color or Image</h3>
                    <div className="color-picker-row">
                      <label className="color-swatch-label">
                        <input
                          type="color"
                          className="color-input"
                          value={customColor}
                          onChange={(e) => {
                            setCustomColor(e.target.value);
                            vtuber.setBackground('gradient', e.target.value);
                          }}
                        />
                        <span className="color-hex">{customColor.toUpperCase()}</span>
                      </label>
                      <button
                        type="button"
                        className="btn-secondary compact-btn"
                        onClick={() => vtuber.setBackground('gradient', customColor)}
                      >
                        Apply
                      </button>
                    </div>
                    <div className="vrm-card-actions">
                      <button
                        type="button"
                        className="btn-secondary icon-label-btn"
                        onClick={() => bgImageInputRef.current?.click()}
                      >
                        <ImageIcon size={14} />
                        <span>
                          {isImageBg ? 'Replace Background Image' : 'Upload Background Image'}
                        </span>
                      </button>
                      {isImageBg && (
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() =>
                            vtuber.setBackground('gradient', BACKGROUND_PRESETS[4]!.value)
                          }
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: Overlays */}
              {activeTab === 'overlays' && (
                <div className="panel">
                  <div className="panel-section">
                    <h3 className="panel-title">Add Layer</h3>
                    <div className="overlay-add-stack">
                      <div className="overlay-text-form">
                        <input
                          type="text"
                          className="overlay-text-input"
                          placeholder="Add stream text label..."
                          maxLength={40}
                          value={newOverlayText}
                          onChange={(e) => setNewOverlayText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addTextOverlay();
                          }}
                        />
                        <button
                          type="button"
                          className="btn-secondary overlay-add-btn"
                          disabled={!newOverlayText.trim()}
                          onClick={addTextOverlay}
                        >
                          Add
                        </button>
                      </div>

                      <div
                        className="emoji-picker-row"
                        role="group"
                        aria-label="Quick emoji stickers"
                      >
                        {QUICK_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className="emoji-chip"
                            title={`Add ${emoji} overlay`}
                            onClick={() =>
                              vtuber.addOverlay({
                                id: `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                type: 'emoji',
                                content: emoji,
                                x: 0.2 + Math.random() * 0.6,
                                y: 0.2 + Math.random() * 0.6,
                                scale: 1,
                                rotation: 0,
                                opacity: 0.9,
                              })
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      <input
                        ref={overlayImageInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            if (typeof reader.result === 'string') {
                              vtuber.addOverlay({
                                id: `overlay-${Date.now()}`,
                                type: 'image',
                                content: reader.result,
                                x: 0.18,
                                y: 0.18,
                                scale: 1,
                                rotation: 0,
                                opacity: 1,
                              });
                            }
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary icon-label-btn"
                        onClick={() => overlayImageInputRef.current?.click()}
                      >
                        <ImageIcon size={14} />
                        <span>Import Image Layer</span>
                      </button>
                    </div>
                  </div>

                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Active Layers ({vtuber.overlays.length})</h3>
                      {vtuber.overlays.length > 0 && (
                        <button
                          type="button"
                          className="link-action danger"
                          onClick={() => vtuber.setOverlays([])}
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    {vtuber.overlays.length === 0 ? (
                      <div className="empty-card">
                        No active overlays. Add text, an emoji sticker, or a transparent PNG above.
                      </div>
                    ) : (
                      <div className="overlay-list">
                        {vtuber.overlays.map((item) => (
                          <div key={item.id} className="overlay-item">
                            <div className="overlay-item-header">
                              <div className="overlay-preview">
                                {item.type === 'emoji' ? (
                                  <span className="overlay-emoji">{item.content}</span>
                                ) : item.type === 'image' && item.content ? (
                                  <img
                                    className="overlay-thumb"
                                    src={item.content}
                                    alt="Overlay layer"
                                  />
                                ) : (
                                  <span className="overlay-type-badge">TXT</span>
                                )}
                              </div>
                              <div className="overlay-item-title">
                                <span className="overlay-name">
                                  {item.type === 'image' ? 'Image Layer' : item.content}
                                </span>
                                <span className="overlay-kind">{item.type}</span>
                              </div>
                              <button
                                type="button"
                                className="btn-icon danger"
                                aria-label="Remove overlay"
                                onClick={() => vtuber.removeOverlay(item.id)}
                              >
                                <TrashIcon size={13} />
                              </button>
                            </div>

                            <div className="overlay-controls-grid">
                              <label className="slider-field">
                                <span className="slider-head">
                                  <span>Pos X</span>
                                  <span>{Math.round(item.x * 100)}%</span>
                                </span>
                                <input
                                  type="range"
                                  className="studio-range"
                                  min="0.05"
                                  max="0.95"
                                  step="0.02"
                                  value={item.x}
                                  style={
                                    {
                                      '--range-pct': `${((item.x - 0.05) / 0.9) * 100}%`,
                                    } as React.CSSProperties
                                  }
                                  onChange={(e) =>
                                    vtuber.updateOverlay(item.id, {
                                      x: parseFloat(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label className="slider-field">
                                <span className="slider-head">
                                  <span>Pos Y</span>
                                  <span>{Math.round(item.y * 100)}%</span>
                                </span>
                                <input
                                  type="range"
                                  className="studio-range"
                                  min="0.05"
                                  max="0.95"
                                  step="0.02"
                                  value={item.y}
                                  style={
                                    {
                                      '--range-pct': `${((item.y - 0.05) / 0.9) * 100}%`,
                                    } as React.CSSProperties
                                  }
                                  onChange={(e) =>
                                    vtuber.updateOverlay(item.id, {
                                      y: parseFloat(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label className="slider-field">
                                <span className="slider-head">
                                  <span>Scale</span>
                                  <span>{item.scale.toFixed(1)}×</span>
                                </span>
                                <input
                                  type="range"
                                  className="studio-range"
                                  min="0.4"
                                  max="3"
                                  step="0.1"
                                  value={item.scale}
                                  style={
                                    {
                                      '--range-pct': `${((item.scale - 0.4) / 2.6) * 100}%`,
                                    } as React.CSSProperties
                                  }
                                  onChange={(e) =>
                                    vtuber.updateOverlay(item.id, {
                                      scale: parseFloat(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label className="slider-field">
                                <span className="slider-head">
                                  <span>Opacity</span>
                                  <span>{Math.round(item.opacity * 100)}%</span>
                                </span>
                                <input
                                  type="range"
                                  className="studio-range"
                                  min="0"
                                  max="1"
                                  step="0.05"
                                  value={item.opacity}
                                  style={
                                    {
                                      '--range-pct': `${item.opacity * 100}%`,
                                    } as React.CSSProperties
                                  }
                                  onChange={(e) =>
                                    vtuber.updateOverlay(item.id, {
                                      opacity: parseFloat(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label className="slider-field span-2">
                                <span className="slider-head">
                                  <span>Rotation</span>
                                  <span>{item.rotation}°</span>
                                </span>
                                <input
                                  type="range"
                                  className="studio-range"
                                  min="-180"
                                  max="180"
                                  step="5"
                                  value={item.rotation}
                                  style={
                                    {
                                      '--range-pct': `${((item.rotation + 180) / 360) * 100}%`,
                                    } as React.CSSProperties
                                  }
                                  onChange={(e) =>
                                    vtuber.updateOverlay(item.id, {
                                      rotation: parseFloat(e.target.value),
                                    })
                                  }
                                />
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: Saved Scene Profiles & Editable Keyboard Shortcuts */}
              {activeTab === 'hotkeys' && (
                <div className="panel">
                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Scene Profiles</h3>
                      <button
                        type="button"
                        className="link-action"
                        onClick={() => profileImportRef.current?.click()}
                      >
                        <UploadIcon size={12} />
                        Import JSON
                      </button>
                    </div>
                    <div className="overlay-text-form">
                      <input
                        type="text"
                        className="overlay-text-input"
                        placeholder="Profile name (e.g. Just Chatting)"
                        maxLength={48}
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveProfile();
                        }}
                      />
                      <button
                        type="button"
                        className="btn-secondary overlay-add-btn icon-label-btn"
                        onClick={handleSaveProfile}
                      >
                        <SaveIcon size={13} />
                        Save
                      </button>
                    </div>
                    {profileNotice && <p className="profile-notice">{profileNotice}</p>}
                    {profiles.length === 0 ? (
                      <div className="empty-card">
                        Save your avatar style, backdrop, lighting, camera framing, expressions, and
                        tuning as reusable scenes.
                      </div>
                    ) : (
                      <div className="profile-list">
                        {profiles.map((prof) => (
                          <div key={prof.id} className="profile-row">
                            <button
                              type="button"
                              className="profile-load-btn"
                              onClick={() => {
                                applyStudioProfile(prof.data);
                                setProfileNotice(`Loaded "${prof.name}"`);
                                window.setTimeout(() => setProfileNotice(null), 1800);
                              }}
                            >
                              <span className="profile-name">{prof.name}</span>
                              <span className="profile-meta">
                                {prof.data.camera.zoom.toFixed(1)}× · {prof.data.lighting.preset}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              title="Export profile JSON"
                              aria-label={`Export ${prof.name}`}
                              onClick={() => handleExportProfile(prof.name, prof.data)}
                            >
                              <DownloadIcon size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon danger"
                              title="Delete profile"
                              aria-label={`Delete ${prof.name}`}
                              onClick={() => deleteProfile(prof.id)}
                            >
                              <TrashIcon size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Avatar Hotkeys (Click to Rebind)</h3>
                      <button
                        type="button"
                        className="link-action"
                        onClick={() => {
                          setRebindingAction(null);
                          vtuber.resetHotkeys();
                        }}
                      >
                        <RotateCcwIcon size={12} />
                        Defaults
                      </button>
                    </div>
                    <div className="hotkey-list">
                      {vtuber.hotkeys.map((hk) => {
                        const isListening = rebindingAction === hk.action;
                        return (
                          <div key={hk.action} className="hotkey-row">
                            <span className="hotkey-action">{hk.label}</span>
                            <button
                              type="button"
                              className={`hotkey-bind-btn ${isListening ? 'listening' : ''}`}
                              onClick={() => setRebindingAction(isListening ? null : hk.action)}
                              title="Click then press a key to rebind (Esc to cancel)"
                            >
                              {isListening
                                ? 'Press key...'
                                : hk.key === ' '
                                  ? 'Space'
                                  : hk.key.toUpperCase()}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="panel-section">
                    <h3 className="panel-title">Stage Shortcuts</h3>
                    <div className="hotkey-list">
                      {STUDIO_SHORTCUTS.map((item) => (
                        <div key={item.key} className="hotkey-row">
                          <span className="hotkey-action">{item.label}</span>
                          <kbd>{item.key}</kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: Setup, Tracking Calibration & Camera Hardware */}
              {activeTab === 'settings' && (
                <div className="panel">
                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Tracking Calibration &amp; Motion</h3>
                      {hasCalibration && (
                        <button
                          type="button"
                          className="link-action"
                          onClick={handleResetCalibration}
                        >
                          Clear Zero
                        </button>
                      )}
                    </div>
                    <div className="card-box">
                      <button
                        type="button"
                        className={`ctrl-btn ${calibratedFlash ? 'active' : ''}`}
                        onClick={handleCalibrate}
                      >
                        <TargetIcon size={14} />
                        <span>
                          {calibratedFlash
                            ? 'Neutral Pose Calibrated!'
                            : hasCalibration
                              ? 'Re-Calibrate Center (C)'
                              : 'Calibrate Neutral Pose (C)'}
                        </span>
                      </button>

                      <div className="overlay-controls-grid" style={{ marginTop: 10 }}>
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Sensitivity</span>
                            <span>{trackingTuning.headSensitivity.toFixed(2)}×</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="0.3"
                            max="2.0"
                            step="0.05"
                            value={trackingTuning.headSensitivity}
                            style={
                              {
                                '--range-pct': `${((trackingTuning.headSensitivity - 0.3) / 1.7) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setTrackingTuning((prev) => ({
                                ...prev,
                                headSensitivity: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="slider-field">
                          <span className="slider-head">
                            <span>Smoothing</span>
                            <span>{Math.round(trackingTuning.smoothing * 100)}%</span>
                          </span>
                          <input
                            type="range"
                            className="studio-range"
                            min="0"
                            max="0.9"
                            step="0.05"
                            value={trackingTuning.smoothing}
                            style={
                              {
                                '--range-pct': `${(trackingTuning.smoothing / 0.9) * 100}%`,
                              } as React.CSSProperties
                            }
                            onChange={(e) =>
                              setTrackingTuning((prev) => ({
                                ...prev,
                                smoothing: parseFloat(e.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                    </div>

                    <div className="setting-group">
                      <div className="setting-row">
                        <span>Auto-Blink</span>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={trackingTuning.autoBlink}
                            onChange={(e) =>
                              setTrackingTuning((prev) => ({
                                ...prev,
                                autoBlink: e.target.checked,
                              }))
                            }
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="setting-row">
                        <span>Idle Breathing</span>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={trackingTuning.idleBreathing}
                            onChange={(e) =>
                              setTrackingTuning((prev) => ({
                                ...prev,
                                idleBreathing: e.target.checked,
                              }))
                            }
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="panel-section">
                    <h3 className="panel-title">Camera &amp; Inference</h3>
                    <div className="setting-group">
                      <div className="setting-row stacked">
                        <div className="setting-label-row">
                          <span>Camera Source</span>
                          <button
                            type="button"
                            className="link-action"
                            onClick={() => void vtuber.refreshCameras()}
                            title="Refresh camera list"
                          >
                            <RefreshIcon size={12} />
                            Refresh
                          </button>
                        </div>
                        <select
                          className="setting-select full"
                          value={settings.deviceId ?? ''}
                          onChange={(e) => restartWith({ deviceId: e.target.value || null })}
                        >
                          <option value="">Default Webcam</option>
                          {vtuber.cameras.map((cam, i) => (
                            <option key={cam.deviceId} value={cam.deviceId}>
                              {cam.label || `Camera ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="setting-row">
                        <span>Delegate</span>
                        <div
                          className="segmented-control"
                          role="group"
                          aria-label="Inference delegate"
                        >
                          {(['GPU', 'CPU'] as const).map((del) => (
                            <button
                              key={del}
                              type="button"
                              className={`seg-btn ${settings.delegate === del ? 'active' : ''}`}
                              onClick={() => restartWith({ delegate: del })}
                            >
                              {del}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="setting-row">
                        <span>Target FPS</span>
                        <div className="segmented-control" role="group" aria-label="Max FPS">
                          {MAX_FPS_CHOICES.map((fps) => (
                            <button
                              key={fps}
                              type="button"
                              className={`seg-btn ${settings.maxFps === fps ? 'active' : ''}`}
                              onClick={() => {
                                if (isMaxFps(fps)) updateSettings({ maxFps: fps });
                              }}
                            >
                              {fps}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="setting-row">
                        <span>
                          Worker Thread
                          <span
                            className={`worker-indicator ${vtuber.useWorker ? 'active' : ''}`}
                            title={
                              vtuber.useWorker
                                ? 'Off-thread pose extraction active'
                                : 'Main-thread extraction'
                            }
                          />
                        </span>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={vtuber.useWorker}
                            onChange={(e) => vtuber.setUseWorker(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="panel-section">
                    <h3 className="panel-title">Studio Preferences</h3>
                    <div className="setting-group">
                      <div className="setting-row">
                        <span>Canvas Debug Readout</span>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={settings.showDebug}
                            onChange={(e) => updateSettings({ showDebug: e.target.checked })}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="setting-row">
                        <span>Auto-Start Camera</span>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={settings.autoStart}
                            onChange={(e) => updateSettings({ autoStart: e.target.checked })}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                      <div className="setting-row">
                        <span>Transparency Grid</span>
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={showChecker}
                            onChange={(e) => setShowChecker(e.target.checked)}
                          />
                          <span className="toggle-slider" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        {/* Center Broadcast Stage */}
        <main
          ref={stageContainerRef}
          className="viewport"
          onDragOver={handleStageDragOver}
          onDragLeave={handleStageDragLeave}
          onDrop={handleStageDrop}
        >
          {cleanMode && (
            <button type="button" className="exit-clean-pill" onClick={() => setCleanMode(false)}>
              <EyeIcon size={14} />
              <span>Exit Clean Mode (Esc)</span>
            </button>
          )}

          <div className="stage-column">
            <div
              className={`render-canvas-wrapper ${showTransparentGrid ? 'checker-surface' : ''} ${
                isDraggingAsset ? 'dragging' : ''
              }`}
              style={showTransparentGrid ? undefined : { background: backgroundStyle }}
              onWheel={handleStageWheel}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onPointerCancel={handleStagePointerUp}
              onDoubleClick={() => setCameraConfig(DEFAULT_STAGE_CAMERA)}
            >
              {isImageBg && (
                <img
                  className="stage-bg-image"
                  src={vtuber.backgroundValue}
                  alt="Custom stage backdrop"
                />
              )}

              <video ref={videoRef} className="input-video" playsInline muted />
              <canvas ref={vrmCanvasRef} className="gl-canvas" />
              <canvas ref={overlayCanvasRef} className="overlay-canvas" />

              {/* Drag-and-drop prompt for .vrm or .png */}
              {isDraggingAsset && (
                <div className="drop-overlay">
                  <UploadIcon size={28} />
                  <span>Drop a .vrm 3D model or .png avatar</span>
                </div>
              )}

              {/* Non-blocking camera boot progress toast */}
              {!cleanMode && cameraBooting && (
                <div className="stage-toast" role="status" aria-live="polite">
                  <div className="stage-toast-spinner" />
                  <div className="stage-toast-body">
                    <span className="stage-toast-text">{vtuber.status}</span>
                    <div className="progress-bar compact">
                      <div className="progress-fill" style={{ width: `${vtuber.progress}%` }} />
                    </div>
                  </div>
                  <button type="button" className="mini-toggle" onClick={stopCamera}>
                    Cancel
                  </button>
                </div>
              )}

              {/* Non-blocking camera/popout/recording warning toast */}
              {!cleanMode &&
                !cameraBooting &&
                (visibleCameraError ||
                  vtuber.trackingError ||
                  stageRecorder.error ||
                  popout.error) && (
                  <div className="stage-toast error" role="status">
                    <AlertTriangleIcon size={15} />
                    <span className="stage-toast-text">
                      {stageRecorder.error ??
                        popout.error ??
                        visibleCameraError ??
                        vtuber.trackingError}
                    </span>
                    {visibleCameraError && (
                      <>
                        <button type="button" className="mini-toggle on" onClick={startTracking}>
                          Retry
                        </button>
                        <button
                          type="button"
                          className="perf-close"
                          aria-label="Dismiss message"
                          onClick={() => setDismissedError(vtuber.error)}
                        >
                          <XIcon size={12} />
                        </button>
                      </>
                    )}
                  </div>
                )}

              {/* Subtle Stage HUD */}
              {!cleanMode && (
                <div className="viewport-hud">
                  <div className="hud-left-group">
                    <div className="hud-pill">
                      <span
                        className={`hud-dot ${
                          vtuber.isLoaded
                            ? vtuber.isTracking
                              ? 'active'
                              : ''
                            : audioLipSync.enabled
                              ? 'active'
                              : ''
                        }`}
                      />
                      <span>
                        {vtuber.isLoaded
                          ? vtuber.isTracking
                            ? 'LIVE'
                            : 'PAUSED'
                          : audioLipSync.enabled
                            ? 'MIC MODE'
                            : 'PREVIEW'}
                      </span>
                    </div>
                    {popout.isOpen && (
                      <div className="hud-pill popout">
                        <span>OBS POP-OUT</span>
                      </div>
                    )}
                    {stageRecorder.isRecording && (
                      <div className="hud-pill rec">
                        <span className="rec-dot" />
                        <span>REC {formatDuration(stageRecorder.durationSec)}</span>
                      </div>
                    )}
                  </div>
                  {vtuber.pose && (
                    <div className="hud-pill mono">
                      {`Y ${(vtuber.pose.headX * 10).toFixed(1)}° · P ${(vtuber.pose.headY * 10).toFixed(1)}°`}
                    </div>
                  )}
                </div>
              )}

              {/* Live Webcam + FaceMesh Landmark PiP */}
              {!cleanMode && showWebcamPip && (
                <WebcamPreview
                  videoRef={videoRef}
                  landmarksRef={vtuber.landmarksRef}
                  onClose={() => setShowWebcamPip(false)}
                />
              )}

              {/* Performance Telemetry Drawer */}
              {!cleanMode && (
                <PerformanceMonitor
                  fps={vtuber.fps}
                  inferenceTime={vtuber.inferenceTime}
                  isTracking={vtuber.isTracking}
                />
              )}
            </div>

            {/* Compact Pro Stage Action Dock */}
            {!cleanMode && (
              <div className="stage-toolbar" role="toolbar" aria-label="Stage actions">
                <button
                  type="button"
                  className={`dock-btn ${vtuber.isLoaded && !vtuber.isTracking ? 'warn' : ''}`}
                  onClick={vtuber.isLoaded ? vtuber.toggleTracking : startTracking}
                  disabled={cameraBooting}
                  title="Start / Pause Camera Tracking (Space)"
                >
                  {vtuber.isLoaded && vtuber.isTracking ? (
                    <PauseIcon size={14} />
                  ) : (
                    <PlayIcon size={14} />
                  )}
                  <span>
                    {!vtuber.isLoaded ? 'Camera' : vtuber.isTracking ? 'Pause' : 'Resume'}
                  </span>
                </button>

                <button
                  type="button"
                  className={`dock-btn ${audioLipSync.enabled ? 'active' : ''}`}
                  onClick={audioLipSync.toggle}
                  title="Toggle Microphone Lip-Sync"
                >
                  {audioLipSync.enabled ? <MicIcon size={14} /> : <MicOffIcon size={14} />}
                  <span>Mic</span>
                </button>

                <button
                  type="button"
                  className={`dock-btn ${calibratedFlash ? 'success' : hasCalibration ? 'active' : ''}`}
                  onClick={handleCalibrate}
                  disabled={!vtuber.isLoaded}
                  title="Calibrate neutral center pose (C)"
                >
                  <TargetIcon size={14} />
                  <span>{calibratedFlash ? 'Centered' : 'Calibrate'}</span>
                </button>

                <button
                  type="button"
                  className={`dock-btn ${showWebcamPip ? 'active' : ''}`}
                  onClick={() => setShowWebcamPip((v) => !v)}
                  title="Show Webcam & Face Mesh Overlay (V)"
                >
                  <VideoIcon size={14} />
                  <span>Mesh</span>
                </button>

                <span className="dock-sep" aria-hidden="true" />

                <button
                  type="button"
                  className={`dock-btn ${mirrored ? 'active' : ''}`}
                  onClick={() => setMirrored((v) => !v)}
                  title="Mirror avatar horizontally (M)"
                >
                  <FlipHorizontalIcon size={14} />
                  <span>Mirror</span>
                </button>

                <button
                  type="button"
                  className={`dock-btn ${snapshotSaved ? 'success' : ''}`}
                  onClick={handleSnapshot}
                  title="Save crisp 1024×1024 PNG snapshot"
                >
                  {snapshotSaved ? <CheckIcon size={14} /> : <CameraIcon size={14} />}
                  <span>{snapshotSaved ? 'Saved' : 'Snap'}</span>
                </button>

                {stageRecorder.supported && (
                  <button
                    type="button"
                    className={`dock-btn ${stageRecorder.isRecording ? 'danger' : ''}`}
                    onClick={handleToggleRecording}
                    title="Record stage video clip with backdrop & mic (.webm)"
                  >
                    {stageRecorder.isRecording ? (
                      <StopSquareIcon size={14} />
                    ) : (
                      <RecordIcon size={14} />
                    )}
                    <span>{stageRecorder.isRecording ? 'Stop' : 'Rec'}</span>
                  </button>
                )}

                <span className="dock-sep" aria-hidden="true" />

                <button
                  type="button"
                  className={`dock-btn ${popout.isOpen ? 'active' : ''}`}
                  onClick={popout.togglePopout}
                  title="Open clean Pop-Out OBS Stage Window"
                >
                  <ExternalLinkIcon size={14} />
                  <span>Pop-Out</span>
                </button>

                <button
                  type="button"
                  className="dock-btn"
                  onClick={() => setCleanMode(true)}
                  title="OBS Clean Mode (Z)"
                >
                  <EyeOffIcon size={14} />
                  <span>Clean</span>
                </button>

                <button
                  type="button"
                  className="dock-btn"
                  onClick={toggleFullscreen}
                  title="Toggle Fullscreen"
                >
                  {isFullscreen ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right Inspector */}
        {!cleanMode && rightOpen && (
          <aside className="right-panel" aria-label="Live Inspector">
            <div className="avatar-card">
              <div className="avatar-card-icon">
                <CubeIcon size={20} />
              </div>
              <div className="avatar-card-info">
                <span className="avatar-card-name">{activeAvatarTitle}</span>
                <span className="avatar-card-sub">{activeRendererLabel}</span>
              </div>
              <button
                type="button"
                className="avatar-card-btn"
                onClick={() => vrmInputRef.current?.click()}
                title="Load a custom .vrm 3D avatar"
              >
                <UploadIcon size={13} />
                <span>.VRM</span>
              </button>
            </div>

            <div className="inspector-section">
              <h3 className="panel-title">Tracking Telemetry</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">
                    {vtuber.pose || audioLipSync.enabled
                      ? `${Math.round(Math.max(vtuber.pose?.mouthRatio ?? 0, audioLipSync.level) * 100)}%`
                      : '—'}
                  </div>
                  <div className="stat-label">Mouth Open</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {vtuber.pose ? `${(vtuber.pose.headX * 10).toFixed(1)}°` : '—'}
                  </div>
                  <div className="stat-label">Head Yaw</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">
                    {vtuber.pose ? `${(vtuber.pose.headY * 10).toFixed(1)}°` : '—'}
                  </div>
                  <div className="stat-label">Head Pitch</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value small">{vtuber.videoResolution}</div>
                  <div className="stat-label">Camera Feed</div>
                </div>
              </div>
            </div>

            <div className="inspector-section">
              <h3 className="panel-title">Face &amp; Voice Signals</h3>
              <div className="pose-bars">
                {vtuber.pose || audioLipSync.enabled ? (
                  <>
                    <PoseBar label="Left Eye" value={vtuber.pose?.eyeLHTemp ?? 0} />
                    <PoseBar label="Right Eye" value={vtuber.pose?.eyeRHTemp ?? 0} />
                    <PoseBar
                      label="Mouth"
                      value={Math.min(
                        Math.max(vtuber.pose?.mouthRatio ?? 0, audioLipSync.level),
                        1,
                      )}
                    />
                    <PoseBar label="Mic Input" value={audioLipSync.level} />
                    <PoseBar label="Gaze X" value={Math.abs(vtuber.pose?.eyeXRatio ?? 0) / 5} />
                  </>
                ) : (
                  <p className="empty-inline">Start Camera or Mic to inspect live signals.</p>
                )}
              </div>
            </div>

            <div className="inspector-section">
              <h3 className="panel-title">Runtime Diagnostics</h3>
              <div className="sys-info">
                <div className="sys-row">
                  <span>Camera</span>
                  <span className={`sys-status ${vtuber.isLoaded ? 'ok' : 'busy'}`}>
                    {vtuber.isLoaded ? 'Active' : cameraBooting ? 'Starting' : 'Standby'}
                  </span>
                </div>
                <div className="sys-row">
                  <span>Output HD</span>
                  <span>
                    {STAGE_RENDER_SIZE}×{STAGE_RENDER_SIZE}
                  </span>
                </div>
                <div className="sys-row">
                  <span>Calibration</span>
                  <span>{hasCalibration ? 'Centered' : 'Default'}</span>
                </div>
                <div className="sys-row">
                  <span>OBS Pop-Out</span>
                  <span>{popout.isOpen ? 'Connected' : 'Closed'}</span>
                </div>
                <div className="sys-row">
                  <span>Delegate</span>
                  <span>{vtuber.delegate}</span>
                </div>
              </div>
            </div>

            <div className="inspector-section">
              <button
                type="button"
                className="accordion-trigger"
                aria-expanded={creditsOpen}
                onClick={() => setCreditsOpen((v) => !v)}
              >
                <span className="panel-title">Credits &amp; Contributors</span>
                <ChevronDownIcon
                  size={14}
                  className={`accordion-chevron ${creditsOpen ? 'open' : ''}`}
                />
              </button>
              {creditsOpen && <ContributorsSection />}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function PoseBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="pose-bar">
      <div className="pose-bar-label">
        <span>{label}</span>
        <span>{(clamped * 100).toFixed(0)}%</span>
      </div>
      <div className="pose-bar-track">
        <div
          className="pose-bar-fill"
          style={{
            width: `${clamped * 100}%`,
            background:
              clamped > 0.7
                ? 'linear-gradient(90deg, var(--accent), var(--violet))'
                : clamped > 0.35
                  ? 'var(--accent)'
                  : 'rgba(244, 114, 182, 0.45)',
          }}
        />
      </div>
    </div>
  );
}

export default App;
