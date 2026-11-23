import type {
  AvatarAccessory,
  AvatarAppearance,
  AvatarMode,
  AvatarPresetId,
  PngAvatarConfig,
} from '../types';
import { AVATAR_PRESETS, shadeHex } from '../character/avatarAppearance';
import { CubeIcon, SparklesIcon, TrashIcon, UploadIcon, UserIcon } from './Icons';

interface AvatarPanelProps {
  avatarMode: AvatarMode;
  onSelectMode: (mode: AvatarMode) => void;
  appearance: AvatarAppearance;
  onChangeAppearance: (next: AvatarAppearance) => void;
  vrmModelName: string | null;
  vrmError: string | null;
  vrmPersisted: boolean;
  onBrowseVrm: () => void;
  onResetVrm: () => void;
  pngConfig: PngAvatarConfig;
  pngHasIdle: boolean;
  pngHasTalking: boolean;
  pngHasBlinking: boolean;
  pngError: string | null;
  onBrowsePngSlot: (slot: 'idle' | 'talking' | 'blinking') => void;
  onClearPngSlot: (slot: 'idle' | 'talking' | 'blinking') => void;
  onChangePngConfig: (patch: Partial<PngAvatarConfig>) => void;
}

const PRESET_LIST: { id: Exclude<AvatarPresetId, 'custom'>; label: string }[] = [
  { id: 'sakura', label: 'Sakura' },
  { id: 'kitsune', label: 'Kitsune' },
  { id: 'neko', label: 'Neko' },
  { id: 'cyber', label: 'Cyber' },
  { id: 'midnight', label: 'Midnight' },
];

const ACCESSORIES: { id: AvatarAccessory; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'fox-ears', label: 'Fox Ears' },
  { id: 'cat-ears', label: 'Cat Ears' },
  { id: 'halo', label: 'Halo' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'horns', label: 'Horns' },
];

export function AvatarPanel({
  avatarMode,
  onSelectMode,
  appearance,
  onChangeAppearance,
  vrmModelName,
  vrmError,
  vrmPersisted,
  onBrowseVrm,
  onResetVrm,
  pngConfig,
  pngHasIdle,
  pngHasTalking,
  pngHasBlinking,
  pngError,
  onBrowsePngSlot,
  onClearPngSlot,
  onChangePngConfig,
}: AvatarPanelProps) {
  return (
    <div className="panel">
      <div className="panel-section">
        <h3 className="panel-title">Avatar Engine</h3>
        <div className="mode-grid" role="group" aria-label="Avatar mode">
          <button
            type="button"
            className={`mode-card ${avatarMode === 'studio' ? 'active' : ''}`}
            onClick={() => onSelectMode('studio')}
          >
            <SparklesIcon size={16} />
            <span className="mode-card-title">Studio 2D</span>
            <span className="mode-card-sub">Built-in rig</span>
          </button>
          <button
            type="button"
            className={`mode-card ${avatarMode === 'png' ? 'active' : ''}`}
            onClick={() => onSelectMode('png')}
          >
            <UserIcon size={16} />
            <span className="mode-card-title">PNGTuber</span>
            <span className="mode-card-sub">Any PNG art</span>
          </button>
          <button
            type="button"
            className={`mode-card ${avatarMode === 'vrm' ? 'active' : ''}`}
            onClick={() => onSelectMode('vrm')}
          >
            <CubeIcon size={16} />
            <span className="mode-card-title">VRM 3D</span>
            <span className="mode-card-sub">.vrm model</span>
          </button>
        </div>
      </div>

      {/* Studio Procedural Customizer */}
      {avatarMode === 'studio' && (
        <>
          <div className="panel-section">
            <h3 className="panel-title">Character Presets</h3>
            <div className="preset-grid cols-3">
              {PRESET_LIST.map((p) => {
                const preset = AVATAR_PRESETS[p.id];
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`preset-chip swatch-chip ${appearance.presetId === p.id ? 'active' : ''}`}
                    onClick={() => onChangeAppearance(preset)}
                  >
                    <span className="swatch-dot" style={{ background: preset.hairColor }} />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="panel-section">
            <h3 className="panel-title">Accessories</h3>
            <div className="preset-grid cols-3">
              {ACCESSORIES.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  className={`preset-chip ${appearance.accessory === acc.id ? 'active' : ''}`}
                  onClick={() =>
                    onChangeAppearance({
                      ...appearance,
                      presetId: 'custom',
                      accessory: acc.id,
                    })
                  }
                >
                  {acc.label}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-section">
            <h3 className="panel-title">Custom Palette</h3>
            <div className="palette-grid">
              <label className="palette-cell">
                <input
                  type="color"
                  className="color-input"
                  value={appearance.hairColor}
                  onChange={(e) => {
                    const hex = e.target.value;
                    onChangeAppearance({
                      ...appearance,
                      presetId: 'custom',
                      hairColor: hex,
                      hairDark: shadeHex(hex, -0.26),
                      hairLight: shadeHex(hex, 0.34),
                    });
                  }}
                />
                <span>Hair</span>
              </label>
              <label className="palette-cell">
                <input
                  type="color"
                  className="color-input"
                  value={appearance.eyeColor}
                  onChange={(e) => {
                    const hex = e.target.value;
                    onChangeAppearance({
                      ...appearance,
                      presetId: 'custom',
                      eyeColor: hex,
                      eyeDark: shadeHex(hex, -0.35),
                    });
                  }}
                />
                <span>Eyes</span>
              </label>
              <label className="palette-cell">
                <input
                  type="color"
                  className="color-input"
                  value={appearance.skinColor}
                  onChange={(e) => {
                    const hex = e.target.value;
                    onChangeAppearance({
                      ...appearance,
                      presetId: 'custom',
                      skinColor: hex,
                      skinShade: shadeHex(hex, -0.1),
                    });
                  }}
                />
                <span>Skin</span>
              </label>
              <label className="palette-cell">
                <input
                  type="color"
                  className="color-input"
                  value={appearance.outfitColor}
                  onChange={(e) => {
                    const hex = e.target.value;
                    onChangeAppearance({
                      ...appearance,
                      presetId: 'custom',
                      outfitColor: hex,
                    });
                  }}
                />
                <span>Outfit</span>
              </label>
            </div>
          </div>
        </>
      )}

      {/* PNGTuber Reactive 2D Avatar */}
      {avatarMode === 'png' && (
        <>
          <div className="panel-section">
            <h3 className="panel-title">2D Sprites (Saved Locally)</h3>
            <div className="vrm-drop-card">
              <div className="vrm-card-meta">
                <span className="vrm-card-title">
                  {pngHasIdle ? pngConfig.name || 'Custom PNG Avatar' : 'No PNG Sprite Loaded'}
                </span>
                <span className="vrm-card-sub">
                  Upload any transparent PNG/WebP — or drop it onto the stage. Talking &amp;
                  Blinking sprites are optional.
                </span>
              </div>

              <div className="sprite-slot-list">
                <div className="sprite-slot">
                  <div className="sprite-slot-info">
                    <span className="sprite-slot-name">Idle (Base)</span>
                    <span className={`sprite-badge ${pngHasIdle ? 'ready' : ''}`}>
                      {pngHasIdle ? 'Loaded' : 'Required'}
                    </span>
                  </div>
                  <div className="sprite-slot-btns">
                    <button
                      type="button"
                      className="btn-secondary compact-btn"
                      onClick={() => onBrowsePngSlot('idle')}
                    >
                      {pngHasIdle ? 'Swap' : 'Upload'}
                    </button>
                    {pngHasIdle && (
                      <button
                        type="button"
                        className="btn-icon danger"
                        aria-label="Clear PNG avatar"
                        onClick={() => onClearPngSlot('idle')}
                      >
                        <TrashIcon size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="sprite-slot">
                  <div className="sprite-slot-info">
                    <span className="sprite-slot-name">Talking Mouth</span>
                    <span className={`sprite-badge ${pngHasTalking ? 'ready' : ''}`}>
                      {pngHasTalking ? 'Loaded' : 'Optional'}
                    </span>
                  </div>
                  <div className="sprite-slot-btns">
                    <button
                      type="button"
                      className="btn-secondary compact-btn"
                      disabled={!pngHasIdle}
                      onClick={() => onBrowsePngSlot('talking')}
                    >
                      {pngHasTalking ? 'Swap' : 'Upload'}
                    </button>
                    {pngHasTalking && (
                      <button
                        type="button"
                        className="btn-icon danger"
                        aria-label="Clear talking sprite"
                        onClick={() => onClearPngSlot('talking')}
                      >
                        <TrashIcon size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="sprite-slot">
                  <div className="sprite-slot-info">
                    <span className="sprite-slot-name">Eyes Closed (Blink)</span>
                    <span className={`sprite-badge ${pngHasBlinking ? 'ready' : ''}`}>
                      {pngHasBlinking ? 'Loaded' : 'Optional'}
                    </span>
                  </div>
                  <div className="sprite-slot-btns">
                    <button
                      type="button"
                      className="btn-secondary compact-btn"
                      disabled={!pngHasIdle}
                      onClick={() => onBrowsePngSlot('blinking')}
                    >
                      {pngHasBlinking ? 'Swap' : 'Upload'}
                    </button>
                    {pngHasBlinking && (
                      <button
                        type="button"
                        className="btn-icon danger"
                        aria-label="Clear blinking sprite"
                        onClick={() => onClearPngSlot('blinking')}
                      >
                        <TrashIcon size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {pngError && <p className="vrm-error-text">{pngError}</p>}
            </div>
          </div>

          <div className="panel-section">
            <h3 className="panel-title">Reactive Motion</h3>
            <div className="card-box">
              <div className="overlay-controls-grid">
                <label className="slider-field">
                  <span className="slider-head">
                    <span>Talk Bounce</span>
                    <span>{Math.round(pngConfig.bounceStrength * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    className="studio-range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={pngConfig.bounceStrength}
                    style={
                      {
                        '--range-pct': `${(pngConfig.bounceStrength / 1.5) * 100}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) =>
                      onChangePngConfig({ bounceStrength: parseFloat(e.target.value) })
                    }
                  />
                </label>
                <label className="slider-field">
                  <span className="slider-head">
                    <span>2.5D Parallax</span>
                    <span>{Math.round(pngConfig.parallaxStrength * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    className="studio-range"
                    min="0"
                    max="1.5"
                    step="0.05"
                    value={pngConfig.parallaxStrength}
                    style={
                      {
                        '--range-pct': `${(pngConfig.parallaxStrength / 1.5) * 100}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) =>
                      onChangePngConfig({ parallaxStrength: parseFloat(e.target.value) })
                    }
                  />
                </label>
                <label className="slider-field span-2">
                  <span className="slider-head">
                    <span>Talk Trigger Threshold</span>
                    <span>{Math.round(pngConfig.talkThreshold * 100)}%</span>
                  </span>
                  <input
                    type="range"
                    className="studio-range"
                    min="0.04"
                    max="0.6"
                    step="0.02"
                    value={pngConfig.talkThreshold}
                    style={
                      {
                        '--range-pct': `${((pngConfig.talkThreshold - 0.04) / 0.56) * 100}%`,
                      } as React.CSSProperties
                    }
                    onChange={(e) =>
                      onChangePngConfig({ talkThreshold: parseFloat(e.target.value) })
                    }
                  />
                </label>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VRM 3D Avatar */}
      {avatarMode === 'vrm' && (
        <div className="panel-section">
          <h3 className="panel-title">VRM 3D Model (0.x &amp; 1.0)</h3>
          <div className="vrm-drop-card">
            <div className="vrm-card-meta">
              <span className="vrm-card-title">{vrmModelName ?? 'No .vrm Model Loaded'}</span>
              <span className="vrm-card-sub">
                {vrmModelName
                  ? vrmPersisted
                    ? 'Active & saved locally in browser — drop another .vrm to swap.'
                    : 'Active in session — drop another .vrm to swap.'
                  : 'Drop a .vrm file anywhere onto the stage, or browse below. Create free models in VRoid Studio.'}
              </span>
            </div>
            <div className="vrm-card-actions">
              <button type="button" className="btn-secondary icon-label-btn" onClick={onBrowseVrm}>
                <UploadIcon size={14} />
                <span>{vrmModelName ? 'Replace .vrm' : 'Load .vrm Model'}</span>
              </button>
              {vrmModelName && (
                <button type="button" className="btn-ghost" onClick={onResetVrm}>
                  Clear
                </button>
              )}
            </div>
            {vrmError && <p className="vrm-error-text">{vrmError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
