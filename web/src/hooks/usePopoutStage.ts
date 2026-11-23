import { useCallback, useEffect, useRef, useState } from 'react';

export interface PopoutStageApi {
  isOpen: boolean;
  error: string | null;
  openPopout: () => void;
  closePopout: () => void;
  togglePopout: () => void;
  pushFrame: (sourceCanvas: HTMLCanvasElement, backdropCss: string) => void;
}

/**
 * Opens a clean, zero-UI same-origin popup window ("EasyVtuber — OBS Stage")
 * so streamers can capture ONLY the avatar in OBS Window Capture while keeping
 * full studio controls accessible in the main tab.
 *
 * Uses safe DOM node construction (no `document.write` or `innerHTML`).
 */
export function usePopoutStage(renderSize: number): PopoutStageApi {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const winRef = useRef<Window | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastBgRef = useRef<string>('');

  const closePopout = useCallback(() => {
    const win = winRef.current;
    winRef.current = null;
    ctxRef.current = null;
    lastBgRef.current = '';
    if (win && !win.closed) {
      try {
        win.close();
      } catch {
        // Ignore cross-window teardown errors.
      }
    }
    setIsOpen(false);
  }, []);

  const openPopout = useCallback(() => {
    setError(null);
    if (winRef.current && !winRef.current.closed) {
      winRef.current.focus();
      return;
    }

    const popup = window.open(
      '',
      'easyvtuber_obs_stage',
      'width=760,height=760,menubar=no,toolbar=no,location=no,status=no,resizable=yes',
    );
    if (!popup) {
      setError('Pop-up blocked by browser. Allow pop-ups for this site to open the OBS Stage.');
      return;
    }

    try {
      const doc = popup.document;
      doc.title = 'EasyVtuber — OBS Stage';

      // Clear any previous content safely
      while (doc.head.firstChild) doc.head.removeChild(doc.head.firstChild);
      while (doc.body.firstChild) doc.body.removeChild(doc.body.firstChild);

      const style = doc.createElement('style');
      style.textContent = [
        'html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden;',
        'display: flex; align-items: center; justify-content: center; background: #00b140; }',
        'canvas { width: min(100vw, 100vh); height: min(100vw, 100vh); display: block; }',
      ].join('\n');
      doc.head.appendChild(style);

      const canvas = doc.createElement('canvas');
      canvas.width = renderSize;
      canvas.height = renderSize;
      canvas.title = 'Double-click for fullscreen';
      canvas.addEventListener('dblclick', () => {
        if (!doc.fullscreenElement) {
          void doc.documentElement.requestFullscreen?.().catch(() => {});
        } else {
          void doc.exitFullscreen?.().catch(() => {});
        }
      });
      doc.body.appendChild(canvas);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        popup.close();
        setError('Could not initialize canvas in OBS Stage window.');
        return;
      }

      winRef.current = popup;
      ctxRef.current = ctx;
      lastBgRef.current = '';
      setIsOpen(true);

      popup.addEventListener('beforeunload', () => {
        winRef.current = null;
        ctxRef.current = null;
        setIsOpen(false);
      });
    } catch (err) {
      popup.close();
      setError(err instanceof Error ? err.message : 'Failed to initialize OBS Stage window.');
    }
  }, [renderSize]);

  const togglePopout = useCallback(() => {
    if (winRef.current && !winRef.current.closed) {
      closePopout();
    } else {
      openPopout();
    }
  }, [closePopout, openPopout]);

  const pushFrame = useCallback(
    (sourceCanvas: HTMLCanvasElement, backdropCss: string) => {
      const win = winRef.current;
      const ctx = ctxRef.current;
      if (!win || !ctx) return;
      if (win.closed) {
        winRef.current = null;
        ctxRef.current = null;
        setIsOpen(false);
        return;
      }
      if (backdropCss !== lastBgRef.current) {
        lastBgRef.current = backdropCss;
        win.document.body.style.background =
          backdropCss === 'transparent' ? '#000000' : backdropCss;
      }
      ctx.clearRect(0, 0, renderSize, renderSize);
      ctx.drawImage(sourceCanvas, 0, 0, renderSize, renderSize);
    },
    [renderSize],
  );

  useEffect(() => {
    return () => {
      closePopout();
    };
  }, [closePopout]);

  return {
    isOpen,
    error,
    openPopout,
    closePopout,
    togglePopout,
    pushFrame,
  };
}
