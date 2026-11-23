import { type DragEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  useVtuber,
  BackgroundType,
  ExpressionState,
  PoseData,
  type InferenceDelegate,
} from './hooks/useVtuber';
import { useContributors, FALLBACK_COUNT } from './hooks/useContributors';
import { useSettings, isMaxFps, MAX_FPS_CHOICES } from './hooks/useSettings';
import { WebGLCharacterRenderer } from './utils/webglRenderer';
import { VRMCharacterRenderer } from './utils/vrmRenderer';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckIcon,
  ChevronDownIcon,
  CubeIcon,
  EyeIcon,
  EyeOffIcon,
  FlipHorizontalIcon,
  ImageIcon,
  KeyboardIcon,
  LayersIcon,
  MaximizeIcon,
  MinimizeIcon,
  PaletteIcon,
  PanelLeftIcon,
  PanelRightIcon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  RotateCcwIcon,
  SlidersIcon,
  SmileIcon,
  TrashIcon,
  UploadIcon,
} from './components/Icons';
import { drawCharacter, drawHUD, drawOverlays, smoothPose } from './character/canvas2d';
import { CANVAS_SIZE } from './character/spec';

// Progressive enhancement: loads ./models/character.vrm if present, otherwise
// falls back to procedural WebGL / Canvas2D.
const VRM_MODEL_URL = './models/character.vrm';

type TabId = 'expressions' | 'backgrounds' | 'overlays' | 'hotkeys' | 'settings';

const TABS: { id: TabId; label: string; icon: ReactNode }[] = [
  { id: 'expressions', label: 'Face', icon: <SmileIcon size={16} /> },
  { id: 'backgrounds', label: 'Stage', icon: <PaletteIcon size={16} /> },
  { id: 'overlays', label: 'Layers', icon: <LayersIcon size={16} /> },
  { id: 'hotkeys', label: 'Keys', icon: <KeyboardIcon size={16} /> },
  { id: 'settings', label: 'Setup', icon: <SlidersIcon size={16} /> },
];

const EXPRESSION_CONTROLS: { key: keyof ExpressionState; label: string; hotkey: string }[] = [
  { key: 'mouthOpen', label: 'Mouth Open', hotkey: '1' },
  { key: 'eyebrowRaise', label: 'Eyebrow Raise', hotkey: '2' },
  { key: 'eyeSmile', label: 'Eye Smile', hotkey: '3' },
  { key: 'cheekPuff', label: 'Cheek Blush', hotkey: '4' },
];

const EXPRESSION_PRESETS: { name: string; values: ExpressionState }[] = [
  { name: 'Neutral', values: { mouthOpen: 0, eyebrowRaise: 0, eyeSmile: 0, cheekPuff: 0 } },
  { name: 'Happy', values: { mouthOpen: 0.45, eyebrowRaise: 0.25, eyeSmile: 1, cheekPuff: 0.6 } },
  { name: 'Surprised', values: { mouthOpen: 0.9, eyebrowRaise: 1, eyeSmile: 0, cheekPuff: 0.2 } },
  { name: 'Shy', values: { mouthOpen: 0.15, eyebrowRaise: 0.3, eyeSmile: 0.8, cheekPuff: 1 } },
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
  { key: 'M', label: 'Mirror Stage' },
  { key: 'Z', label: 'OBS Clean Mode' },
  { key: '`', label: 'Performance Telemetry' },
  { key: 'Esc', label: 'Exit Clean Mode' },
];

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const webglRendererRef = useRef<WebGLCharacterRenderer | null>(null);
  const vrmCanvasRef = useRef<HTMLCanvasElement>(null);
  const vrmRendererRef = useRef<VRMCharacterRenderer | null>(null);
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const vrmObjectUrlRef = useRef<string | null>(null);
  const vrmInputRef = useRef<HTMLInputElement>(null);
  const overlayImageInputRef = useRef<HTMLInputElement>(null);
  const initStarted = useRef(false);
  const animFrameRef = useRef(0);
  const smoothedPoseRef = useRef<PoseData | null>(null);

  const [activeTab, setActiveTab] = useState<TabId>('expressions');
  const [rendererMode, setRendererMode] = useState<'VRM 3D' | 'WebGL' | 'Canvas 2D'>('Canvas 2D');
  const [vrmModelName, setVrmModelName] = useState<string | null>(null);
  const [vrmError, setVrmError] = useState<string | null>(null);
  const [newOverlayText, setNewOverlayText] = useState('');
  const [customColor, setCustomColor] = useState('#141828');
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [cleanMode, setCleanMode] = useState(false);
  const [mirrored, setMirrored] = useState(false);
  const [showChecker, setShowChecker] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggingVrm, setIsDraggingVrm] = useState(false);
  const [snapshotSaved, setSnapshotSaved] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);

  const vtuber = useVtuber();
  const { loadModels, setMaxFps } = vtuber;
  const { settings, updateSettings } = useSettings();

  const showDebugRef = useRef(settings.showDebug);
  useEffect(() => {
    showDebugRef.current = settings.showDebug;
  }, [settings.showDebug]);

  const startTracking = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void loadModels(video, {
      delegate: settings.delegate,
      deviceId: settings.deviceId ?? undefined,
    });
  }, [settings.delegate, settings.deviceId, loadModels]);

  useEffect(() => {
    if (!settings.autoStart || initStarted.current) return;
    initStarted.current = true;
    startTracking();
  }, [settings.autoStart, startTracking]);

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

  // Initialize WebGL renderer on hidden GL canvas
  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    if (!glCanvas) return;
    glCanvas.width = CANVAS_SIZE;
    glCanvas.height = CANVAS_SIZE;
    try {
      const renderer = new WebGLCharacterRenderer(glCanvas);
      webglRendererRef.current = renderer;
      if (renderer.isReady()) {
        queueMicrotask(() => setRendererMode((prev) => (prev === 'VRM 3D' ? prev : 'WebGL')));
      }
    } catch {
      console.warn('WebGL renderer init failed, falling back to Canvas 2D');
    }

    return () => {
      webglRendererRef.current?.destroy();
      webglRendererRef.current = null;
    };
  }, []);

  // Initialize VRM renderer on its own hidden canvas
  useEffect(() => {
    const vrmCanvas = vrmCanvasRef.current;
    if (!vrmCanvas) return;
    vrmCanvas.width = CANVAS_SIZE;
    vrmCanvas.height = CANVAS_SIZE;
    let cancelled = false;
    try {
      const renderer = new VRMCharacterRenderer(vrmCanvas);
      vrmRendererRef.current = renderer;
      void renderer.loadModel(VRM_MODEL_URL).then((ok) => {
        if (cancelled) return;
        if (ok) {
          setRendererMode('VRM 3D');
          setVrmModelName('character.vrm');
        } else {
          console.info('No VRM character model loaded — using procedural fallback renderer.');
        }
      });
    } catch (e) {
      console.warn('VRM renderer init failed, falling back:', e);
    }

    return () => {
      cancelled = true;
      if (vrmObjectUrlRef.current) {
        URL.revokeObjectURL(vrmObjectUrlRef.current);
        vrmObjectUrlRef.current = null;
      }
      vrmRendererRef.current?.destroy();
      vrmRendererRef.current = null;
    };
  }, []);

  const handleVrmUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.vrm')) {
      setVrmError('Please select a .vrm avatar file.');
      return;
    }
    const renderer = vrmRendererRef.current;
    if (!renderer) {
      setVrmError('VRM WebGL renderer is unavailable in this browser.');
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
      setVrmModelName(file.name);
      setRendererMode('VRM 3D');
    } else {
      URL.revokeObjectURL(nextUrl);
      setVrmError(`Could not load "${file.name}". Ensure it is a valid VRM 0.x/1.0 model.`);
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
    setRendererMode(webglRendererRef.current?.isReady() ? 'WebGL' : 'Canvas 2D');
  }, []);

  const handleSnapshot = useCallback(() => {
    const source = overlayCanvasRef.current;
    if (!source) return;
    const out = document.createElement('canvas');
    out.width = CANVAS_SIZE;
    out.height = CANVAS_SIZE;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    if (mirrored) {
      ctx.translate(CANVAS_SIZE, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, 0, 0);
    const link = document.createElement('a');
    link.download = `easyvtuber-${Date.now()}.png`;
    link.href = out.toDataURL('image/png');
    link.click();
    setSnapshotSaved(true);
    window.setTimeout(() => setSnapshotSaved(false), 1800);
  }, [mirrored]);

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

  // Studio-level keyboard shortcuts (M: mirror, Z: OBS clean mode, Esc: exit clean mode)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'm') {
        e.preventDefault();
        setMirrored((v) => !v);
      } else if (key === 'z') {
        e.preventDefault();
        setCleanMode((v) => !v);
      } else if (e.key === 'Escape') {
        setCleanMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleStageDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingVrm(true);
  }, []);

  const handleStageDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setIsDraggingVrm(false);
  }, []);

  const handleStageDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDraggingVrm(false);
      const file = e.dataTransfer.files?.[0];
      if (file) {
        void handleVrmUpload(file);
      }
    },
    [handleVrmUpload],
  );

  // Persistent RAF render loop
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    let running = true;
    const render = () => {
      if (!running) return;
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      const rawPose = vtuber.poseRef.current;
      smoothedPoseRef.current = smoothPose(rawPose, smoothedPoseRef.current);
      const currentPose = smoothedPoseRef.current;
      const currentOverlays = vtuber.overlaysRef.current;
      const isTracking = vtuber.trackingRef.current;
      const expression = vtuber.expressionRef.current;

      const vrmRenderer = vrmRendererRef.current;
      const vrmDrawn = vrmRenderer?.isReady()
        ? vrmRenderer.render(vtuber.landmarksRef.current, expression)
        : false;

      const gl = webglRendererRef.current;
      const webglDrawn = !vrmDrawn && gl ? gl.render(currentPose, expression) : false;

      if (vrmDrawn && vrmCanvasRef.current) {
        ctx.drawImage(vrmCanvasRef.current, 0, 0);
      } else if (webglDrawn && glCanvasRef.current) {
        ctx.drawImage(glCanvasRef.current, 0, 0);
      } else {
        drawCharacter(ctx, currentPose, expression);
      }

      drawOverlays(ctx, currentOverlays);
      if (showDebugRef.current) {
        drawHUD(ctx, currentPose, isTracking);
      } else if (!isTracking) {
        drawHUD(ctx, null, false);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
    // vtuber refs are stable — no deps needed, this effect runs once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const backgroundStyle = vtuber.background === 'none' ? 'transparent' : vtuber.backgroundValue;
  const showTransparentGrid = vtuber.background === 'none' && showChecker && !cleanMode;
  const statusTone = vtuber.error
    ? 'error'
    : vtuber.isLoaded
      ? vtuber.isTracking
        ? 'online'
        : 'paused'
      : 'offline';

  return (
    <div className={`app ${cleanMode ? 'clean-mode' : ''}`}>
      {/* Hidden VRM input shared across Settings & Inspector */}
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
              {rendererMode}
            </span>
          </div>

          <div className="header-center">
            <div className="status-pill" role="status" aria-live="polite">
              <span className={`status-indicator ${statusTone}`} />
              <span className="status-text">
                {vtuber.isLoaded
                  ? vtuber.isTracking
                    ? 'Tracking Live'
                    : 'Tracking Paused'
                  : vtuber.status}
              </span>
            </div>
            {vtuber.isLoaded ? (
              <button
                type="button"
                className={`header-action-btn ${vtuber.isTracking ? '' : 'paused'}`}
                onClick={vtuber.toggleTracking}
              >
                {vtuber.isTracking ? <PauseIcon size={13} /> : <PlayIcon size={13} />}
                <span>{vtuber.isTracking ? 'Pause' : 'Resume'}</span>
              </button>
            ) : (
              <button type="button" className="header-action-btn primary" onClick={startTracking}>
                <PlayIcon size={13} />
                <span>{vtuber.error ? 'Retry' : 'Start'}</span>
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
              className="icon-btn"
              onClick={() => setCleanMode(true)}
              aria-label="Enter OBS Clean Mode"
              title="OBS Clean Mode — hide chrome (Z)"
            >
              <EyeOffIcon size={16} />
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
              {/* Expressions Tab */}
              {activeTab === 'expressions' && (
                <div className="panel">
                  <div className="panel-section">
                    <div className="section-header">
                      <h3 className="panel-title">Quick Presets</h3>
                      <button
                        type="button"
                        className="link-action"
                        onClick={vtuber.resetExpression}
                      >
                        <RotateCcwIcon size={12} />
                        Reset
                      </button>
                    </div>
                    <div className="preset-grid">
                      {EXPRESSION_PRESETS.map((preset) => {
                        const isMatch = EXPRESSION_CONTROLS.every(
                          (c) => Math.abs(vtuber.expression[c.key] - preset.values[c.key]) < 0.05,
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
                        const val = vtuber.expression[expr.key];
                        const isActive = val > 0.05;
                        return (
                          <div key={expr.key} className={`expr-card ${isActive ? 'active' : ''}`}>
                            <div className="expr-card-top">
                              <div className="expr-meta">
                                <kbd className="mini-kbd">{expr.hotkey}</kbd>
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

                  <div className="panel-section">
                    <h3 className="panel-title">Session Controls</h3>
                    <div className="tracking-controls">
                      {vtuber.isLoaded ? (
                        <button
                          type="button"
                          className={`ctrl-btn ${vtuber.isTracking ? 'primary' : 'paused'}`}
                          onClick={vtuber.toggleTracking}
                        >
                          {vtuber.isTracking ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                          <span>{vtuber.isTracking ? 'Pause Tracking' : 'Resume Tracking'}</span>
                        </button>
                      ) : (
                        <button type="button" className="ctrl-btn primary" onClick={startTracking}>
                          <PlayIcon size={15} />
                          <span>{vtuber.error ? 'Retry Tracking' : 'Start Camera Tracking'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={`ctrl-btn ${mirrored ? 'active' : ''}`}
                        onClick={() => setMirrored((v) => !v)}
                      >
                        <FlipHorizontalIcon size={15} />
                        <span>{mirrored ? 'Mirrored Output' : 'Mirror Output'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Backgrounds / Stage Tab */}
              {activeTab === 'backgrounds' && (
                <div className="panel">
                  <div className="panel-section">
                    <h3 className="panel-title">Broadcast & Keying</h3>
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
                    <h3 className="panel-title">Custom Solid Backdrop</h3>
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
                  </div>
                </div>
              )}

              {/* Overlays Tab */}
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
                          onClick={() =>
                            vtuber.overlays.forEach((item) => vtuber.removeOverlay(item.id))
                          }
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

              {/* Hotkeys Tab */}
              {activeTab === 'hotkeys' && (
                <div className="panel">
                  <div className="panel-section">
                    <h3 className="panel-title">Avatar Shortcuts</h3>
                    <div className="hotkey-list">
                      {vtuber.hotkeys.map((hk) => (
                        <div key={hk.action} className="hotkey-row">
                          <span className="hotkey-action">{hk.label}</span>
                          <kbd>{hk.key === ' ' ? 'Space' : hk.key.toUpperCase()}</kbd>
                        </div>
                      ))}
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
                    <p className="panel-hint">
                      Shortcuts are automatically suspended while typing inside input fields.
                    </p>
                  </div>
                </div>
              )}

              {/* Settings Tab */}
              {activeTab === 'settings' && (
                <div className="panel">
                  <div className="panel-section">
                    <h3 className="panel-title">3D Avatar (.vrm)</h3>
                    <div className="vrm-drop-card">
                      <div className="vrm-card-meta">
                        <span className="vrm-card-title">
                          {vrmModelName ?? 'Procedural Avatar'}
                        </span>
                        <span className="vrm-card-sub">
                          {vrmModelName
                            ? 'VRM 3D model active — drop another .vrm to swap'
                            : 'Drop a .vrm file onto the stage or browse below'}
                        </span>
                      </div>
                      <div className="vrm-card-actions">
                        <button
                          type="button"
                          className="btn-secondary icon-label-btn"
                          onClick={() => vrmInputRef.current?.click()}
                        >
                          <UploadIcon size={14} />
                          <span>{vrmModelName ? 'Replace .vrm' : 'Load .vrm Model'}</span>
                        </button>
                        {vrmModelName && (
                          <button type="button" className="btn-ghost" onClick={handleVrmReset}>
                            Revert
                          </button>
                        )}
                      </div>
                      {vrmError && <p className="vrm-error-text">{vrmError}</p>}
                    </div>
                  </div>

                  <div className="panel-section">
                    <h3 className="panel-title">Camera & Inference</h3>
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
                isDraggingVrm ? 'dragging' : ''
              }`}
              style={showTransparentGrid ? undefined : { background: backgroundStyle }}
            >
              <video ref={videoRef} className="input-video" playsInline muted />
              <canvas ref={glCanvasRef} className="gl-canvas" />
              <canvas ref={vrmCanvasRef} className="gl-canvas" />

              <canvas
                ref={overlayCanvasRef}
                className={`overlay-canvas ${vtuber.isLoaded ? '' : 'canvas-hidden'} ${
                  mirrored ? 'mirrored' : ''
                }`}
              />

              {/* Drag-and-drop .vrm prompt */}
              {isDraggingVrm && (
                <div className="drop-overlay">
                  <UploadIcon size={28} />
                  <span>Drop .vrm avatar to load</span>
                </div>
              )}

              {/* Loading / Error State */}
              {!vtuber.isLoaded && (
                <div className="viewport-placeholder">
                  {vtuber.error ? (
                    <div className="error-state">
                      <div className="error-icon-wrap">
                        <AlertTriangleIcon size={26} />
                      </div>
                      <h2 className="state-heading">Camera Initialization Failed</h2>
                      <p className="error-text">{vtuber.error}</p>
                      <button type="button" className="btn-primary" onClick={startTracking}>
                        Retry Tracking
                      </button>
                    </div>
                  ) : (
                    <div className="loading-state">
                      <div className="loading-spinner" />
                      <p className="loading-text">{vtuber.status}</p>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${vtuber.progress}%` }} />
                      </div>
                      {!settings.autoStart && vtuber.progress === 0 && (
                        <button type="button" className="btn-primary" onClick={startTracking}>
                          Start Camera Tracking
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Non-fatal tracking warning */}
              {vtuber.isLoaded && vtuber.trackingError && (
                <div className="tracking-warning" role="status">
                  <AlertTriangleIcon size={13} />
                  <span>{vtuber.trackingError}</span>
                </div>
              )}

              {/* Subtle stage HUD (hidden in OBS Clean Mode) */}
              {!cleanMode && vtuber.isLoaded && (
                <div className="viewport-hud">
                  <div className="hud-pill">
                    <span className={`hud-dot ${vtuber.isTracking ? 'active' : ''}`} />
                    <span>{vtuber.isTracking ? 'LIVE' : 'PAUSED'}</span>
                  </div>
                  {vtuber.pose && (
                    <div className="hud-pill mono">
                      {`Y ${(vtuber.pose.headX * 10).toFixed(1)}° · P ${(vtuber.pose.headY * 10).toFixed(1)}°`}
                    </div>
                  )}
                </div>
              )}

              {/* Performance Telemetry Drawer (hidden in OBS Clean Mode) */}
              {!cleanMode && (
                <PerformanceMonitor
                  fps={vtuber.fps}
                  inferenceTime={vtuber.inferenceTime}
                  isTracking={vtuber.isTracking}
                />
              )}
            </div>

            {/* Compact Stage Action Dock */}
            {!cleanMode && (
              <div className="stage-toolbar" role="toolbar" aria-label="Stage actions">
                <button
                  type="button"
                  className={`dock-btn ${vtuber.isLoaded && !vtuber.isTracking ? 'warn' : ''}`}
                  onClick={vtuber.isLoaded ? vtuber.toggleTracking : startTracking}
                  title="Start / Pause Tracking (Space)"
                >
                  {vtuber.isLoaded && vtuber.isTracking ? (
                    <PauseIcon size={14} />
                  ) : (
                    <PlayIcon size={14} />
                  )}
                  <span>{!vtuber.isLoaded ? 'Start' : vtuber.isTracking ? 'Pause' : 'Resume'}</span>
                </button>

                <button
                  type="button"
                  className={`dock-btn ${mirrored ? 'active' : ''}`}
                  onClick={() => setMirrored((v) => !v)}
                  title="Mirror stage horizontally (M)"
                >
                  <FlipHorizontalIcon size={14} />
                  <span>Mirror</span>
                </button>

                <button
                  type="button"
                  className={`dock-btn ${snapshotSaved ? 'success' : ''}`}
                  onClick={handleSnapshot}
                  disabled={!vtuber.isLoaded}
                  title="Save PNG snapshot"
                >
                  {snapshotSaved ? <CheckIcon size={14} /> : <CameraIcon size={14} />}
                  <span>{snapshotSaved ? 'Saved' : 'Snapshot'}</span>
                </button>

                <span className="dock-sep" aria-hidden="true" />

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
                  <span>{isFullscreen ? 'Exit' : 'Expand'}</span>
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right Inspector */}
        {!cleanMode && rightOpen && (
          <aside className="right-panel" aria-label="Live Inspector">
            {/* Active Avatar Stage Card */}
            <div className="avatar-card">
              <div className="avatar-card-icon">
                <CubeIcon size={20} />
              </div>
              <div className="avatar-card-info">
                <span className="avatar-card-name">{vrmModelName ?? 'Procedural Rig'}</span>
                <span className="avatar-card-sub">{rendererMode} Renderer</span>
              </div>
              <button
                type="button"
                className="avatar-card-btn"
                onClick={() => vrmInputRef.current?.click()}
                title="Load a custom .vrm avatar"
              >
                <UploadIcon size={13} />
                <span>.VRM</span>
              </button>
            </div>

            {/* Live Tracking Metrics */}
            <div className="inspector-section">
              <h3 className="panel-title">Tracking Telemetry</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">
                    {vtuber.pose ? `${(vtuber.pose.mouthRatio * 100).toFixed(0)}%` : '—'}
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

            {/* Live Pose Meters */}
            <div className="inspector-section">
              <h3 className="panel-title">Face Signals</h3>
              <div className="pose-bars">
                {vtuber.pose ? (
                  <>
                    <PoseBar label="Left Eye" value={vtuber.pose.eyeLHTemp} />
                    <PoseBar label="Right Eye" value={vtuber.pose.eyeRHTemp} />
                    <PoseBar label="Mouth" value={Math.min(vtuber.pose.mouthRatio, 1)} />
                    <PoseBar label="Gaze X" value={Math.abs(vtuber.pose.eyeXRatio) / 5} />
                    <PoseBar label="Gaze Y" value={Math.abs(vtuber.pose.eyeYRatio) / 5} />
                  </>
                ) : (
                  <p className="empty-inline">Waiting for face landmarks…</p>
                )}
              </div>
            </div>

            {/* System Diagnostics */}
            <div className="inspector-section">
              <h3 className="panel-title">Runtime Diagnostics</h3>
              <div className="sys-info">
                <div className="sys-row">
                  <span>Status</span>
                  <span className={`sys-status ${vtuber.isLoaded ? 'ok' : 'busy'}`}>
                    {vtuber.isLoaded ? 'Online' : 'Standby'}
                  </span>
                </div>
                <div className="sys-row">
                  <span>Tracker</span>
                  <span>MediaPipe WASM</span>
                </div>
                <div className="sys-row">
                  <span>Delegate</span>
                  <span>{settings.delegate}</span>
                </div>
                <div className="sys-row">
                  <span>Worker</span>
                  <span>{vtuber.useWorker ? 'Off-Thread' : 'Main Thread'}</span>
                </div>
                <div className="sys-row">
                  <span>Layers</span>
                  <span>{vtuber.overlays.length} active</span>
                </div>
              </div>
            </div>

            {/* Collapsible Contributors Drawer */}
            <div className="inspector-section">
              <button
                type="button"
                className="accordion-trigger"
                aria-expanded={creditsOpen}
                onClick={() => setCreditsOpen((v) => !v)}
              >
                <span className="panel-title">Credits & Contributors</span>
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
