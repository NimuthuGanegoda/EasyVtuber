import { useEffect, useState } from 'react';
import { buildObsBrowserUrl } from '../utils/urlParams';
import { CheckIcon, CopyIcon, ExternalLinkIcon, XIcon } from './Icons';

interface StreamGuideModalProps {
  open: boolean;
  mirrored: boolean;
  avatarPreset?: string;
  onClose: () => void;
  onOpenPopout: () => void;
}

export function StreamGuideModal({
  open,
  mirrored,
  avatarPreset,
  onClose,
  onOpenPopout,
}: StreamGuideModalProps) {
  const [obsBg, setObsBg] = useState<'transparent' | 'green' | 'blue'>('transparent');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const baseHref =
    typeof window !== 'undefined'
      ? window.location.href
      : 'https://nimuthuganegoda.github.io/EasyVtuber/';
  const obsUrl = buildObsBrowserUrl(baseHref, {
    bg: obsBg,
    mirrored,
    avatarPreset,
  });

  const handleCopy = () => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(obsUrl).then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      });
    }
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stream-guide-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2 id="stream-guide-title" className="modal-title">
              Go Live in OBS, Twitch, YouTube &amp; Discord
            </h2>
            <p className="modal-subtitle">
              100% local processing in your browser — nothing is ever uploaded.
            </p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close guide">
            <XIcon size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="guide-step">
            <div className="guide-step-head">
              <span className="guide-num">1</span>
              <h3>OBS Studio — Pop-Out Stage (Recommended)</h3>
            </div>
            <p className="guide-text">
              Open a clean frameless stage window so you can control expressions, scenes, and
              overlays here while OBS captures ONLY your avatar.
            </p>
            <ol className="guide-list">
              <li>
                Select <strong>Chroma Green</strong> or <strong>Chroma Blue</strong> in the{' '}
                <strong>Stage</strong> tab.
              </li>
              <li>
                Click <strong>Open Pop-Out OBS Stage</strong> below (or <strong>Pop-Out</strong> in
                the bottom dock).
              </li>
              <li>
                In OBS Studio, add a <strong>Window Capture</strong> source targeting{' '}
                <code>EasyVtuber — OBS Stage</code> and apply a <strong>Chroma Key</strong> filter.
              </li>
            </ol>
            <button
              type="button"
              className="btn-primary icon-label-btn"
              onClick={() => {
                onOpenPopout();
                onClose();
              }}
            >
              <ExternalLinkIcon size={14} />
              <span>Open Pop-Out OBS Stage</span>
            </button>
          </div>

          <div className="guide-step">
            <div className="guide-step-head">
              <span className="guide-num">2</span>
              <h3>OBS Browser Source URL</h3>
            </div>
            <p className="guide-text">
              Paste this clean-stage URL directly into OBS (or bookmark your setup):
            </p>
            <div className="segmented-control" role="group" aria-label="OBS URL backdrop">
              {(['transparent', 'green', 'blue'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`seg-btn ${obsBg === mode ? 'active' : ''}`}
                  onClick={() => setObsBg(mode)}
                >
                  {mode === 'transparent' ? 'Transparent' : mode === 'green' ? 'Green' : 'Blue'}
                </button>
              ))}
            </div>
            <div className="copy-url-row">
              <input type="text" readOnly value={obsUrl} className="overlay-text-input mono" />
              <button
                type="button"
                className="btn-secondary overlay-add-btn icon-label-btn"
                onClick={handleCopy}
              >
                {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="guide-step">
            <div className="guide-step-head">
              <span className="guide-num">3</span>
              <h3>Discord, Zoom &amp; Meet</h3>
            </div>
            <p className="guide-text">
              Once your avatar is in OBS Studio, click <strong>Start Virtual Camera</strong> in OBS
              and select <strong>OBS Virtual Camera</strong> in Discord&apos;s Voice &amp; Video
              settings.
            </p>
          </div>

          <div className="guide-step subtle">
            <div className="guide-step-head">
              <span className="guide-num">★</span>
              <h3>Bring Your Own Avatar</h3>
            </div>
            <p className="guide-text">
              Drop any <strong>.vrm</strong> 3D model (create one free in{' '}
              <a
                href="https://vroid.com/en/studio"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-link"
              >
                VRoid Studio
              </a>
              ) or any transparent <strong>.png / .webp</strong> artwork straight onto the stage.
              Your avatar is stored locally in your browser so it reloads automatically next visit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
