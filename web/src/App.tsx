import { useRef, useEffect, useState } from 'react';
import { useVtuber, BackgroundType, OverlayItem, PoseData } from './hooks/useVtuber';

// Character rendering constants
const CHAR_CENTER_X = 256;
const CHAR_CENTER_Y = 220;
const HEAD_RADIUS = 60;
const EYE_SPACING = 28;
const EYE_RADIUS = 12;
const PUPIL_RADIUS = 5;
const MOUTH_Y = 240;
const MOUTH_MAX_W = 24;

function drawCharacter(ctx: CanvasRenderingContext2D, pose: PoseData | null) {
  ctx.save();

  const headTilt = pose ? (pose.xAngle || 0) * 40 : 0;
  const headTurn = pose ? (pose.yAngle || 0) * 30 : 0;

  ctx.translate(CHAR_CENTER_X + headTurn, CHAR_CENTER_Y + headTilt);

  // Body shape
  ctx.beginPath();
  ctx.ellipse(0, 120, 70, 90, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 183, 197, 0.15)';
  ctx.fill();

  // Neck
  ctx.beginPath();
  ctx.rect(-12, 40, 24, 30);
  ctx.fillStyle = 'rgba(255, 183, 197, 0.2)';
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(0, 0, HEAD_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 200, 210, 0.2)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 183, 197, 0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hair
  ctx.beginPath();
  ctx.arc(0, -10, HEAD_RADIUS + 8, Math.PI, 0);
  ctx.fillStyle = 'rgba(255, 107, 157, 0.3)';
  ctx.fill();

  // Eyes
  const eyeOpenL = pose ? Math.max(0.1, 1 - pose.eyeLHTemp) : 1;
  const eyeOpenR = pose ? Math.max(0.1, 1 - pose.eyeRHTemp) : 1;
  const eyeXOffset = pose ? pose.eyeXRatio * 2 : 0;
  const eyeYOffset = pose ? pose.eyeYRatio * 2 : 0;

  for (const side of [-1, 1]) {
    const ex = side * EYE_SPACING;
    const ey = -8;

    ctx.beginPath();
    ctx.ellipse(ex, ey, EYE_RADIUS, EYE_RADIUS * (side === -1 ? eyeOpenL : eyeOpenR), 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 183, 197, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if ((side === -1 ? eyeOpenL : eyeOpenR) > 0.2) {
      ctx.beginPath();
      ctx.arc(ex + eyeXOffset, ey + eyeYOffset, PUPIL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 107, 157, 0.7)';
      ctx.fill();
    }
  }

  // Eyebrows
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * (EYE_SPACING - 12), -22);
    ctx.lineTo(side * (EYE_SPACING + 12), -22);
    ctx.strokeStyle = 'rgba(255, 183, 197, 0.5)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // Mouth
  const mouthOpen = pose ? Math.min(pose.mouthRatio * 20, 20) : 2;
  ctx.beginPath();
  ctx.ellipse(0, MOUTH_Y, MOUTH_MAX_W, mouthOpen, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 107, 157, 0.4)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 183, 197, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Blush
  for (const side of [-1, 1]) {
    const gradient = ctx.createRadialGradient(side * 45, 15, 0, side * 45, 15, 20);
    gradient.addColorStop(0, 'rgba(255, 107, 157, 0.12)');
    gradient.addColorStop(1, 'rgba(255, 107, 157, 0)');
    ctx.beginPath();
    ctx.arc(side * 45, 15, 20, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  ctx.restore();
}

function drawOverlays(ctx: CanvasRenderingContext2D, overlays: OverlayItem[]) {
  overlays.forEach((item) => {
    if (item.type === 'emoji') {
      ctx.save();
      ctx.font = `${32 * item.scale}px serif`;
      ctx.globalAlpha = item.opacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(item.x * 512, item.y * 512);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.fillText(item.content, 0, 0);
      ctx.restore();
    }
  });
}

function drawHUD(ctx: CanvasRenderingContext2D, pose: PoseData | null, tracking: boolean) {
  if (!pose) return;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Eyes: L${(pose.eyeLHTemp * 100).toFixed(0)}% R${(pose.eyeRHTemp * 100).toFixed(0)}%`, 12, 12);
  ctx.fillText(`Mouth: ${(pose.mouthRatio * 100).toFixed(0)}%`, 12, 28);
  ctx.fillText(`Head: ${(pose.headX * 10).toFixed(1)}°/${(pose.headY * 10).toFixed(1)}°`, 12, 44);

  if (!tracking) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSED', 256, 256);
    ctx.restore();
  }
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTab, setActiveTab] = useState<'expressions' | 'backgrounds' | 'overlays' | 'hotkeys' | 'settings'>('expressions');
  const initStarted = useRef(false);
  const animFrameRef = useRef(0);

  const vtuber = useVtuber();

  // Init tracking on mount
  useEffect(() => {
    if (videoRef.current && !initStarted.current) {
      initStarted.current = true;
      vtuber.loadModels(videoRef.current);
    }
  }, [vtuber.loadModels]);

  // Persistent render refs (avoid RAF re-creation on every frame)
  // Canvas is always rendered below, so this ref will be available when the RAF effect runs
  const renderDataRef = useRef({ pose: null as PoseData | null, overlays: vtuber.overlays, tracking: true });

  // Keep render data ref in sync with state (runs after every render, not every RAF)
  useEffect(() => {
    renderDataRef.current = { pose: vtuber.pose, overlays: vtuber.overlays, tracking: vtuber.isTracking };
  });

  // Single persistent RAF render loop
  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 512;
    canvas.height = 512;

    let running = true;
    const render = () => {
      if (!running) return;
      ctx.clearRect(0, 0, 512, 512);

      const data = renderDataRef.current;
      drawCharacter(ctx, data.pose);
      drawOverlays(ctx, data.overlays);
      drawHUD(ctx, data.pose, data.tracking);

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

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
            {[
              { id: 'expressions' as const, label: 'Expressions', icon: '😊' },
              { id: 'backgrounds' as const, label: 'Backgrounds', icon: '🎨' },
              { id: 'overlays' as const, label: 'Overlays', icon: '✨' },
              { id: 'hotkeys' as const, label: 'Hotkeys', icon: '⌨️' },
              { id: 'settings' as const, label: 'Settings', icon: '⚙️' },
            ].map(tab => (
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
                  {[
                    { key: 'mouthOpen' as const, label: 'Mouth Open', icon: '👄' },
                    { key: 'eyebrowRaise' as const, label: 'Eyebrow', icon: '🤨' },
                    { key: 'eyeSmile' as const, label: 'Eye Smile', icon: '😊' },
                    { key: 'cheekPuff' as const, label: 'Cheek Puff', icon: '😤' },
                  ].map(expr => (
                    <button
                      key={expr.key}
                      className={`expr-btn ${vtuber.expression[expr.key] > 0.5 ? 'active' : ''}`}
                      onClick={() => vtuber.setExpression({
                        [expr.key]: vtuber.expression[expr.key] > 0.5 ? 0 : 1,
                      })}
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

                <h3 className="panel-title" style={{ marginTop: 24 }}>Tracking</h3>
                <div className="tracking-controls">
                  <button
                    className={`ctrl-btn ${vtuber.isTracking ? '' : 'paused'}`}
                    onClick={vtuber.toggleTracking}
                  >
                    {vtuber.isTracking ? '⏸ Pause Tracking' : '▶ Resume Tracking'}
                  </button>
                  <button
                    className={`ctrl-btn ${vtuber.handTracking ? 'active' : ''}`}
                    onClick={() => vtuber.setState({ handTracking: !vtuber.handTracking })}
                    disabled
                  >
                    🖐 Hand Tracking
                  </button>
                </div>
              </div>
            )}

            {/* Backgrounds Panel */}
            {activeTab === 'backgrounds' && (
              <div className="panel">
                <h3 className="panel-title">Scene Backgrounds</h3>
                <div className="background-grid">
                  {[
                    { id: 'gradient' as BackgroundType, label: 'Cyberpunk', colors: ['#0a0a0c', '#1a1a2e', '#16213e'] },
                    { id: 'gradient' as BackgroundType, label: 'Sunset', colors: ['#ff6b6b', '#ffa500', '#ffd93d'] },
                    { id: 'gradient' as BackgroundType, label: 'Forest', colors: ['#0f3443', '#34e89e', '#1a2a1a'] },
                    { id: 'gradient' as BackgroundType, label: 'Ocean', colors: ['#0072ff', '#00c6ff', '#0a1628'] },
                    { id: 'gradient' as BackgroundType, label: 'Lavender', colors: ['#667eea', '#764ba2', '#1a0a2e'] },
                    { id: 'gradient' as BackgroundType, label: 'Crimson', colors: ['#200122', '#6f0000', '#1a0a0a'] },
                    { id: 'none' as BackgroundType, label: 'Transparent', colors: ['#000000', '#000000'] },
                    { id: 'blur' as BackgroundType, label: 'Blur Dark', colors: ['#0a0a0c', '#0a0a0c'] },
                  ].map((bg, i) => (
                    <button
                      key={`${bg.id}-${i}`}
                      className={`bg-btn ${vtuber.backgroundValue.includes(bg.colors[0]) ? 'active' : ''}`}
                      onClick={() => {
                        if (bg.id === 'gradient') {
                          const grad = `linear-gradient(135deg, ${bg.colors[0]} 0%, ${bg.colors[1]} 50%, ${bg.colors[2] || bg.colors[1]} 100%)`;
                          vtuber.setBackground('gradient', grad);
                        } else {
                          vtuber.setBackground(bg.id);
                        }
                      }}
                    >
                      <div
                        className="bg-preview"
                        style={{
                          background: bg.colors.length >= 3
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
                  {vtuber.overlays.map(item => (
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
                            onChange={e => vtuber.updateOverlay(item.id, { opacity: parseFloat(e.target.value) })}
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
                            onChange={e => vtuber.updateOverlay(item.id, { scale: parseFloat(e.target.value) })}
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
                      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                      vtuber.addOverlay({
                        id: String(Date.now()),
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
                  {vtuber.hotkeys.map((hk, i) => (
                    <div key={i} className="hotkey-row">
                      <div className="hotkey-key">
                        <kbd>{hk.key === ' ' ? 'Space' : hk.key.toUpperCase()}</kbd>
                      </div>
                      <span className="hotkey-action">{hk.label}</span>
                    </div>
                  ))}
                </div>
                <p className="panel-hint">
                  Press these keys during your stream to trigger actions
                </p>
              </div>
            )}

            {/* Settings Panel */}
            {activeTab === 'settings' && (
              <div className="panel">
                <h3 className="panel-title">Settings</h3>
                <div className="setting-group">
                  <div className="setting-row">
                    <span>Camera Source</span>
                    <select className="setting-select">
                      <option>Default Webcam</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Model Quality</span>
                    <select className="setting-select" defaultValue="gpu">
                      <option value="gpu">GPU (Fast)</option>
                      <option value="cpu">CPU (Fallback)</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Max FPS</span>
                    <select className="setting-select" defaultValue="30">
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="60">60</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <span>Show Debug Info</span>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                  <div className="setting-row">
                    <span>Auto-Start Tracking</span>
                    <label className="toggle">
                      <input type="checkbox" defaultChecked />
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
          <div
            className="render-canvas-wrapper"
            style={{
              background: vtuber.background === 'gradient'
                ? vtuber.backgroundValue
                : vtuber.background === 'blur'
                  ? 'rgba(0,0,0,0.7)'
                  : vtuber.background === 'game'
                    ? '#1a1a2e'
                    : 'transparent',
            }}
          >
            {/* Hidden video element for camera input */}
            <video
              ref={videoRef}
              className="input-video"
              playsInline
              muted
            />

            {/* Canvas always rendered so the RAF loop ref works */}
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
                    <button
                      className="btn-primary"
                      onClick={() => window.location.reload()}
                    >
                      Restart System
                    </button>
                  </div>
                ) : (
                  <div className="loading-state">
                    <div className="loading-spinner" />
                    <p className="loading-text">{vtuber.status}</p>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${vtuber.progress}%` }}
                      />
                    </div>
                  </div>
                )}
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
          </div>
        </main>

        {/* Right Panel - Live Stats */}
        <aside className="right-panel">
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

          <h3 className="panel-title" style={{ marginTop: 24 }}>System Info</h3>
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
              <span>Resolution</span>
              <span>640×480</span>
            </div>
            <div className="sys-row">
              <span>Overlays</span>
              <span>{vtuber.overlays.length} active</span>
            </div>
            <div className="sys-row">
              <span>Hand Tracking</span>
              <span className={vtuber.handTracking ? 'text-accent' : 'text-muted'}>
                {vtuber.handTracking ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          <h3 className="panel-title" style={{ marginTop: 24 }}>Pose Values</h3>
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
            backgroundColor: clamped > 0.7 ? '#ff6b9d' : clamped > 0.4 ? '#ffb7c5' : 'rgba(255,183,197,0.4)',
          }}
        />
      </div>
    </div>
  );
}

export default App;
