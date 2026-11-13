import { useCallback, useEffect, useRef, useState } from 'react';
import { useVtuber, BackgroundType, PoseData, type InferenceDelegate } from './hooks/useVtuber';
import { useContributors, FALLBACK_COUNT } from './hooks/useContributors';
import { useSettings, isMaxFps, MAX_FPS_CHOICES } from './hooks/useSettings';
import { WebGLCharacterRenderer } from './utils/webglRenderer';
import { VRMCharacterRenderer } from './utils/vrmRenderer';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { drawCharacter, drawHUD, drawOverlays, smoothPose } from './character/canvas2d';
import { CANVAS_SIZE } from './character/spec';

// Path to a real VRM character model, if one has been supplied (see
// web/README.md, "Character model"). Progressive enhancement: if this 404s,
// VRMCharacterRenderer.loadModel() fails gracefully and the app falls back
// to the procedural WebGL/Canvas2D renderer below, so the app still works
// with no model present.
const VRM_MODEL_URL = './models/character.vrm';

type TabId = 'expressions' | 'backgrounds' | 'overlays' | 'hotkeys' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'expressions', label: 'Expressions', icon: '😊' },
  { id: 'backgrounds', label: 'Backgrounds', icon: '🎨' },
  { id: 'overlays', label: 'Overlays', icon: '✨' },
  { id: 'hotkeys', label: 'Hotkeys', icon: '⌨️' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const EXPRESSION_CONTROLS = [
  { key: 'mouthOpen', label: 'Mouth Open', icon: '👄' },
  { key: 'eyebrowRaise', label: 'Eyebrow', icon: '🤨' },
  { key: 'eyeSmile', label: 'Eye Smile', icon: '😊' },
  { key: 'cheekPuff', label: 'Cheek Puff', icon: '😤' },
] as const;

const BACKGROUND_PRESETS: {
  id: BackgroundType;
  label: string;
  colors: string[];
  gradientStr: string;
}[] = [
  {
    id: 'gradient',
    label: 'Cyberpunk',
    colors: ['#0a0a0c', '#1a1a2e', '#16213e'],
    gradientStr: 'linear-gradient(135deg, #0a0a0c 0%, #1a1a2e 50%, #16213e 100%)',
  },
  {
    id: 'gradient',
    label: 'Sunset',
    colors: ['#ff6b6b', '#ffa500', '#ffd93d'],
    gradientStr: 'linear-gradient(135deg, #ff6b6b 0%, #ffa500 50%, #ffd93d 100%)',
  },
  {
    id: 'gradient',
    label: 'Forest',
    colors: ['#0f3443', '#34e89e', '#1a2a1a'],
    gradientStr: 'linear-gradient(135deg, #0f3443 0%, #34e89e 50%, #1a2a1a 100%)',
  },
  {
    id: 'gradient',
    label: 'Ocean',
    colors: ['#0072ff', '#00c6ff', '#0a1628'],
    gradientStr: 'linear-gradient(135deg, #0072ff 0%, #00c6ff 50%, #0a1628 100%)',
  },
  {
    id: 'gradient',
    label: 'Lavender',
    colors: ['#667eea', '#764ba2', '#1a0a2e'],
    gradientStr: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #1a0a2e 100%)',
  },
  {
    id: 'gradient',
    label: 'Crimson',
    colors: ['#200122', '#6f0000', '#1a0a0a'],
    gradientStr: 'linear-gradient(135deg, #200122 0%, #6f0000 50%, #1a0a0a 100%)',
  },
  {
    id: 'none',
    label: 'Transparent',
    colors: ['#000000', '#000000'],
    gradientStr: 'transparent',
  },
  {
    id: 'blur',
    label: 'Blur Dark',
    colors: ['#0a0a0c', '#0a0a0c'],
    gradientStr: 'rgba(0,0,0,0.6)',
  },
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
            <span className="contributor-name">
              {c.emoji} {c.name}
            </span>
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
  const [activeTab, setActiveTab] = useState<TabId>('expressions');
  const initStarted = useRef(false);
  const animFrameRef = useRef(0);
  const smoothedPoseRef = useRef<PoseData | null>(null);

  const vtuber = useVtuber();
  const { loadModels, setMaxFps } = vtuber;
  const { settings, updateSettings } = useSettings();

  // The RAF loop below is created once, so it reads display settings from a
  // ref rather than closing over a stale value.
  const showDebugRef = useRef(settings.showDebug);
  showDebugRef.current = settings.showDebug;

  const startTracking = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    void loadModels(video, {
      delegate: settings.delegate,
      deviceId: settings.deviceId ?? undefined,
    });
  }, [settings.delegate, settings.deviceId, loadModels]);

  // Auto-start once, if enabled.
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
      // Re-opening the camera / recreating the landmarker is the only way to
      // apply these, so only do it once tracking has already started.
      if (!vtuber.isLoaded) return;
      const video = videoRef.current;
      if (!video) return;
      const delegate = next.delegate ?? settings.delegate;
      const deviceId = next.deviceId === undefined ? settings.deviceId : next.deviceId;
      void loadModels(video, { delegate, deviceId: deviceId ?? undefined });
    },
    [settings.delegate, settings.deviceId, updateSettings, vtuber.isLoaded, loadModels],
  );

  // Initialize WebGL renderer on the hidden GL canvas
  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    if (!glCanvas) return;
    glCanvas.width = CANVAS_SIZE;
    glCanvas.height = CANVAS_SIZE;
    try {
      webglRendererRef.current = new WebGLCharacterRenderer(glCanvas);
    } catch {
      console.warn('WebGL renderer init failed, falling back to Canvas 2D');
    }

    return () => {
      webglRendererRef.current?.destroy();
      webglRendererRef.current = null;
    };
  }, []);

  // Initialize the VRM (real character model) renderer on its own hidden
  // canvas — separate from the procedural gl-canvas since they're two
  // independent WebGL contexts. Progressive enhancement: loadModel() resolves
  // false if no model is present or it fails to load, and the render loop below
  // falls back to the procedural renderer in that case.
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
        if (!ok && !cancelled) {
          console.info('No VRM character model loaded — using procedural fallback renderer.');
        }
      });
    } catch (e) {
      console.warn('VRM renderer init failed, falling back:', e);
    }

    return () => {
      cancelled = true;
      vrmRendererRef.current?.destroy();
      vrmRendererRef.current = null;
    };
  }, []);

  // Single persistent RAF render loop — WebGL for character, Canvas 2D for overlays/HUD
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

      // Read fresh pose/overlay data from refs — updates every frame without React
      const rawPose = vtuber.poseRef.current;
      smoothedPoseRef.current = smoothPose(rawPose, smoothedPoseRef.current);
      const currentPose = smoothedPoseRef.current;
      const currentOverlays = vtuber.overlaysRef.current;
      const isTracking = vtuber.trackingRef.current;
      const expression = vtuber.expressionRef.current;

      // Fallback chain: real VRM character model (if one is present) ->
      // procedural WebGL shapes -> Canvas2D shapes. VRM is driven straight
      // from raw landmarks (Kalidokit does its own solving), not the
      // derived/smoothed PoseData the other two renderers use.
      const vrmRenderer = vrmRendererRef.current;
      const vrmDrawn = vrmRenderer?.isReady()
        ? vrmRenderer.render(vtuber.landmarksRef.current)
        : false;

      const gl = webglRendererRef.current;
      const webglDrawn = !vrmDrawn && gl ? gl.render(currentPose, expression) : false;

      if (vrmDrawn && vrmCanvasRef.current) {
        ctx.drawImage(vrmCanvasRef.current, 0, 0);
      } else if (webglDrawn && glCanvasRef.current) {
        // Composite WebGL output onto the 2D canvas
        ctx.drawImage(glCanvasRef.current, 0, 0);
      } else {
        // Fallback: draw character with Canvas 2D
        drawCharacter(ctx, currentPose, expression);
      }

      // Overlays always render on Canvas 2D (text/compositing)
      drawOverlays(ctx, currentOverlays);
      if (showDebugRef.current) {
        drawHUD(ctx, currentPose, isTracking);
      } else if (!isTracking) {
        // Keep the paused watermark visible even with the debug readout off.
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

  const backgroundStyle =
    vtuber.background === 'gradient'
      ? vtuber.backgroundValue
      : vtuber.background === 'blur'
        ? 'rgba(0,0,0,0.7)'
        : 'transparent';

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo-text">EasyVtuber</div>
          <span className="logo-badge">STUDIO</span>
        </div>
        <div className="header-center">
          <div className={`status-indicator ${vtuber.isLoaded ? 'online' : 'offline'}`} />
          <span className="status-text">{vtuber.status}</span>
        </div>
        <div className="header-right">
          <div className="fps-display">
            <span className="fps-value">{vtuber.fps}</span>
            <span className="fps-label">FPS</span>
          </div>
          <div className="inference-display">
            <span className="inf-value">{vtuber.inferenceTime}</span>
            <span className="inf-label">ms</span>
          </div>
        </div>
      </header>

      <div className="main-layout">
        {/* Left Panel - Controls */}
        <aside className="left-panel">
          {/* Tab Navigation */}
          <div className="tab-nav">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {/* Expressions Panel */}
            {activeTab === 'expressions' && (
              <div className="panel">
                <h3 className="panel-title">Facial Expressions</h3>
                <div className="expression-grid">
                  {EXPRESSION_CONTROLS.map((expr) => (
                    <button
                      key={expr.key}
                      className={`expr-btn ${vtuber.expression[expr.key] > 0.5 ? 'active' : ''}`}
                      onClick={() =>
                        vtuber.setExpression({
                          [expr.key]: vtuber.expression[expr.key] > 0.5 ? 0 : 1,
                        })
                      }
                    >
                      <span className="expr-icon">{expr.icon}</span>
                      <span className="expr-label">{expr.label}</span>
                      <div className="expr-slider">
                        <div
                          className="expr-fill"
                          style={{ width: `${vtuber.expression[expr.key] * 100}%` }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
                <button className="btn-secondary" onClick={vtuber.resetExpression}>
                  Reset All Expressions
                </button>

                <h3 className="panel-title" style={{ marginTop: 24 }}>
                  Tracking
                </h3>
                <div className="tracking-controls">
                  {vtuber.isLoaded ? (
                    <button
                      className={`ctrl-btn ${vtuber.isTracking ? '' : 'paused'}`}
                      onClick={vtuber.toggleTracking}
                    >
                      {vtuber.isTracking ? '⏸ Pause Tracking' : '▶ Resume Tracking'}
                    </button>
                  ) : (
                    <button
                      className="ctrl-btn"
                      onClick={startTracking}
                      disabled={Boolean(vtuber.error)}
                      title={
                        vtuber.error
                          ? 'Fix the error shown in the viewport, then retry'
                          : 'Open the camera and start tracking'
                      }
                    >
                      ▶ Start Tracking
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Backgrounds Panel */}
            {activeTab === 'backgrounds' && (
              <div className="panel">
                <h3 className="panel-title">Scene Backgrounds</h3>
                <div className="background-grid">
                  {BACKGROUND_PRESETS.map((bg) => (
                    <button
                      key={bg.label}
                      className={`bg-btn ${
                        vtuber.background === bg.id && vtuber.backgroundValue === bg.gradientStr
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => vtuber.setBackground(bg.id, bg.gradientStr)}
                    >
                      <div
                        className="bg-preview"
                        style={{
                          background:
                            bg.colors.length >= 3
                              ? `linear-gradient(135deg, ${bg.colors[0]}, ${bg.colors[1]}, ${bg.colors[2]})`
                              : bg.colors[0],
                        }}
                      />
                      <span className="bg-label">{bg.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Overlays Panel */}
            {activeTab === 'overlays' && (
              <div className="panel">
                <h3 className="panel-title">Overlay Items</h3>
                <div className="overlay-list">
                  {vtuber.overlays.map((item) => (
                    <div key={item.id} className="overlay-item">
                      <div className="overlay-preview">
                        {item.type === 'emoji' ? (
                          <span style={{ fontSize: 24 }}>{item.content}</span>
                        ) : (
                          <span className="overlay-type-badge">{item.type}</span>
                        )}
                      </div>
                      <div className="overlay-controls">
                        <label>
                          Opacity
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={item.opacity}
                            onChange={(e) =>
                              vtuber.updateOverlay(item.id, {
                                opacity: parseFloat(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label>
                          Scale
                          <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={item.scale}
                            onChange={(e) =>
                              vtuber.updateOverlay(item.id, { scale: parseFloat(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                      <button
                        className="btn-icon danger"
                        onClick={() => vtuber.removeOverlay(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="overlay-add">
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      const emojis = ['🌸', '⭐', '❤️', '✨', '🎀', '💫', '🌟', '💖'];
                      const emoji = emojis[Math.floor(Math.random() * emojis.length)] ?? '🌸';
                      vtuber.addOverlay({
                        id: `overlay-${Date.now()}`,
                        type: 'emoji',
                        content: emoji,
                        x: 0.2 + Math.random() * 0.6,
                        y: 0.2 + Math.random() * 0.6,
                        scale: 1,
                        rotation: 0,
                        opacity: 0.8,
                      });
                    }}
                  >
                    ✨ Add Decoration
                  </button>
                </div>
              </div>
            )}

            {/* Hotkeys Panel */}
            {activeTab === 'hotkeys' && (
              <div className="panel">
                <h3 className="panel-title">Keyboard Shortcuts</h3>
                <div className="hotkey-list">
                  {vtuber.hotkeys.map((hk) => (
                    <div key={hk.action} className="hotkey-row">
                      <div className="hotkey-key">
                        <kbd>{hk.key === ' ' ? 'Space' : hk.key.toUpperCase()}</kbd>
                      </div>
                      <span className="hotkey-action">{hk.label}</span>
                    </div>
                  ))}
                </div>
                <p className="panel-hint">Press these keys during your stream to trigger actions</p>
              </div>
            )}

            {/* Settings Panel */}
            {activeTab === 'settings' && (
              <div className="panel">
                <h3 className="panel-title">Settings</h3>
                <div className="setting-group">
                  <div className="setting-row">
                    <span>Camera Source</span>
                    <select
                      className="setting-select"
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
                    <span>Model Quality</span>
                    <select
                      className="setting-select"
                      value={settings.delegate}
                      onChange={(e) =>
                        restartWith({
                          delegate: e.target.value === 'CPU' ? 'CPU' : 'GPU',
                        })
                      }
                    >
                      <option value="GPU">GPU (Fast)</option>
                      <option value="CPU">CPU (Fallback)</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Max FPS</span>
                    <select
                      className="setting-select"
                      value={String(settings.maxFps)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (isMaxFps(next)) updateSettings({ maxFps: next });
                      }}
                    >
                      {MAX_FPS_CHOICES.map((fps) => (
                        <option key={fps} value={fps}>
                          {fps}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Show Debug Info</span>
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
                    <span>Auto-Start Tracking</span>
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
                    <span>
                      Worker Extraction
                      <span
                        className={`worker-indicator ${vtuber.useWorker ? 'active' : ''}`}
                        title={
                          vtuber.useWorker
                            ? 'Off-thread pose extraction active'
                            : 'Using main-thread extraction'
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
            )}
          </div>
        </aside>

        {/* Center - Main Viewport */}
        <main className="viewport">
          <div className="render-canvas-wrapper" style={{ background: backgroundStyle }}>
            {/* Hidden video element for camera input */}
            <video ref={videoRef} className="input-video" playsInline muted />

            {/* Hidden WebGL canvas for GPU-accelerated character rendering */}
            <canvas ref={glCanvasRef} className="gl-canvas" />

            {/* Hidden canvas for the real VRM character model, when present */}
            <canvas ref={vrmCanvasRef} className="gl-canvas" />

            {/* Main 2D canvas for overlays, HUD, and fallback rendering */}
            <canvas
              ref={overlayCanvasRef}
              className={`overlay-canvas ${vtuber.isLoaded ? '' : 'canvas-hidden'}`}
            />

            {/* Placeholder overlay when not loaded */}
            {!vtuber.isLoaded && (
              <div className="viewport-placeholder">
                {vtuber.error ? (
                  <div className="error-state">
                    <div className="error-icon">⚠️</div>
                    <p className="error-text">{vtuber.error}</p>
                    <button className="btn-primary" onClick={() => window.location.reload()}>
                      Restart System
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
                      <button className="btn-primary" onClick={startTracking}>
                        Start Tracking
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Non-fatal tracking problem (e.g. a frame that could not be solved) */}
            {vtuber.isLoaded && vtuber.trackingError && (
              <div className="tracking-warning" role="status">
                ⚠ {vtuber.trackingError}
              </div>
            )}

            {/* Top-right status overlay */}
            {vtuber.isLoaded && (
              <div className="viewport-hud">
                <div className="hud-tracking">
                  <div className={`hud-dot ${vtuber.isTracking ? 'active' : ''}`} />
                  {vtuber.isTracking ? 'LIVE' : 'PAUSED'}
                </div>
                {vtuber.pose && (
                  <div className="hud-pose">
                    {`H:${(vtuber.pose.headX * 10).toFixed(1)}°`}
                    {` V:${(vtuber.pose.headY * 10).toFixed(1)}°`}
                  </div>
                )}
              </div>
            )}

            {/* Performance Monitor overlay */}
            <PerformanceMonitor
              fps={vtuber.fps}
              inferenceTime={vtuber.inferenceTime}
              isTracking={vtuber.isTracking}
            />
          </div>
        </main>

        {/* Right Panel - Live Stats & Info */}
        <aside className="right-panel">
          {/* Sakura - AI Assistant */}
          <div className="assistant-card">
            <img
              className="assistant-avatar"
              src="https://api.dicebear.com/9.x/lorelei/svg?seed=Sakura&backgroundColor=ffb7c5&radius=50"
              alt="Sakura"
            />
            <div className="assistant-info">
              <span className="assistant-name">Sakura</span>
              <span className="assistant-title">AI Assistant</span>
            </div>
            <span className="assistant-status" />
          </div>

          <h3 className="panel-title">Live Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{vtuber.fps}</div>
              <div className="stat-label">FPS</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{vtuber.inferenceTime}</div>
              <div className="stat-label">Inference (ms)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {vtuber.pose ? (vtuber.pose.mouthRatio * 100).toFixed(0) : '-'}
              </div>
              <div className="stat-label">Mouth Open %</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {vtuber.pose ? `${(vtuber.pose.headX * 10).toFixed(1)}°` : '-'}
              </div>
              <div className="stat-label">Head Rotation</div>
            </div>
          </div>

          <h3 className="panel-title" style={{ marginTop: 24 }}>
            System Info
          </h3>
          <div className="sys-info">
            <div className="sys-row">
              <span>Status</span>
              <span className={`sys-status ${vtuber.isLoaded ? 'ok' : 'busy'}`}>
                {vtuber.isLoaded ? 'Online' : 'Initializing'}
              </span>
            </div>
            <div className="sys-row">
              <span>Engine</span>
              <span>MediaPipe WASM</span>
            </div>
            <div className="sys-row">
              <span>Delegate</span>
              <span>{settings.delegate}</span>
            </div>
            <div className="sys-row">
              <span>Resolution</span>
              <span>640×480</span>
            </div>
            <div className="sys-row">
              <span>Overlays</span>
              <span>{vtuber.overlays.length} active</span>
            </div>
          </div>

          <h3 className="panel-title" style={{ marginTop: 24 }}>
            Contributors
            {!vtuber.isLoaded && <span className="contributors-badge">GitHub</span>}
          </h3>
          <ContributorsSection />

          <h3 className="panel-title" style={{ marginTop: 24 }}>
            Pose Values
          </h3>
          <div className="pose-bars">
            {vtuber.pose ? (
              <>
                <PoseBar label="Left Eye" value={vtuber.pose.eyeLHTemp} />
                <PoseBar label="Right Eye" value={vtuber.pose.eyeRHTemp} />
                <PoseBar label="Mouth" value={Math.min(vtuber.pose.mouthRatio, 1)} />
                <PoseBar label="Eye X" value={Math.abs(vtuber.pose.eyeXRatio) / 5} />
                <PoseBar label="Eye Y" value={Math.abs(vtuber.pose.eyeYRatio) / 5} />
              </>
            ) : (
              <p className="text-muted">Waiting for tracking data...</p>
            )}
          </div>
        </aside>
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
            backgroundColor:
              clamped > 0.7 ? '#ff6b9d' : clamped > 0.4 ? '#ffb7c5' : 'rgba(255,183,197,0.4)',
          }}
        />
      </div>
    </div>
  );
}

export default App;
