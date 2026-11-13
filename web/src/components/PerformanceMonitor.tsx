import { useEffect, useRef, useState } from 'react';

interface PerfData {
  fps: number;
  inferenceTime: number;
  frameTime: number;
  jsHeap: string;
  domNodes: number;
  tracking: boolean;
}

/** How many samples the sparkline keeps (each sample is a quarter second). */
const HISTORY_LEN = 20;
const SAMPLE_INTERVAL_MS = 250;

interface PerformanceWithMemory extends Performance {
  memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
}

function describeMemory(): string {
  const mem = (performance as PerformanceWithMemory).memory;
  if (!mem || typeof mem.usedJSHeapSize !== 'number') return 'N/A';
  return `${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB`;
}

export function PerformanceMonitor({
  fps,
  inferenceTime,
  isTracking,
}: {
  fps: number;
  inferenceTime: number;
  isTracking: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [perfData, setPerfData] = useState<PerfData>({
    fps: 0,
    inferenceTime: 0,
    frameTime: 0,
    jsHeap: '0 MB',
    domNodes: 0,
    tracking: false,
  });
  // The sparkline used to read `fpsHistoryRef.current` inside JSX, so it never
  // re-rendered when the ref mutated and the bars appeared frozen. History is
  // real state now.
  const [history, setHistory] = useState<number[]>([]);

  // Refs for changing props, so the sampling effect doesn't restart every time
  // a prop changes.
  const fpsRef = useRef(fps);
  const inferRef = useRef(inferenceTime);
  const trackingRef = useRef(isTracking);
  fpsRef.current = fps;
  inferRef.current = inferenceTime;
  trackingRef.current = isTracking;

  // Only sample while the panel is open.
  useEffect(() => {
    if (!visible) return;

    let frameTime = 0;
    let lastFrame = performance.now();
    let rafId = 0;
    const measureFrame = () => {
      const now = performance.now();
      frameTime = now - lastFrame;
      lastFrame = now;
      rafId = requestAnimationFrame(measureFrame);
    };
    rafId = requestAnimationFrame(measureFrame);

    // Sample the DOM node count a few times a second instead of every frame:
    // `document.querySelectorAll('*')` on a production-sized DOM is expensive
    // enough to distort the very numbers being measured.
    const sampleId = window.setInterval(() => {
      const currentFps = fpsRef.current;
      setPerfData({
        fps: currentFps,
        inferenceTime: inferRef.current,
        frameTime: Math.round(frameTime),
        jsHeap: describeMemory(),
        domNodes: document.getElementsByTagName('*').length,
        tracking: trackingRef.current,
      });
      setHistory((prev) => [...prev.slice(-(HISTORY_LEN - 1)), currentFps]);
    }, SAMPLE_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(sampleId);
    };
  }, [visible]);

  // Toggle with backtick key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Never hijack keystrokes destined for a form control.
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!visible) {
    return (
      <button
        className="perf-toggle"
        onClick={() => setVisible(true)}
        title="Show Performance Monitor (press ` to toggle)"
      >
        📊
      </button>
    );
  }

  const { fps: displayFps, frameTime, jsHeap, domNodes, tracking } = perfData;

  return (
    <div className="perf-monitor">
      <div className="perf-header">
        <span>Performance Monitor</span>
        <button className="perf-close" onClick={() => setVisible(false)}>
          ✕
        </button>
      </div>
      <div className="perf-body">
        <PerfRow label="FPS" value={String(displayFps)} warning={displayFps < 20} />
        <PerfRow label="Frame" value={`${frameTime}ms`} warning={frameTime > 50} />
        <PerfRow label="Inference" value={`${inferenceTime}ms`} warning={inferenceTime > 30} />
        <PerfRow label="Heap" value={jsHeap} />
        <PerfRow label="DOM Nodes" value={String(domNodes)} />
        <PerfRow label="Tracking" value={tracking ? 'LIVE' : 'PAUSED'} />
        {/* Mini FPS sparkline */}
        <div className="perf-sparkline">
          {history.map((v, i) => (
            <div
              key={`${i}-${v}`}
              className="perf-spark-bar"
              style={{
                height: `${Math.min((v / 60) * 100, 100)}%`,
                backgroundColor: v < 20 ? 'var(--red)' : v < 40 ? 'var(--yellow)' : 'var(--green)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PerfRow({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className={`perf-row ${warning ? 'perf-warning' : ''}`}>
      <span className="perf-label">{label}</span>
      <span className="perf-value">{value}</span>
    </div>
  );
}
