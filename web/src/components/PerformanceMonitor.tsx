import { useEffect, useRef, useState } from 'react';
import { ActivityIcon, XIcon } from './Icons';

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
  const [history, setHistory] = useState<number[]>([]);

  const fpsRef = useRef(fps);
  const inferRef = useRef(inferenceTime);
  const trackingRef = useRef(isTracking);
  useEffect(() => {
    fpsRef.current = fps;
    inferRef.current = inferenceTime;
    trackingRef.current = isTracking;
  }, [fps, inferenceTime, isTracking]);

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
        type="button"
        className="perf-toggle"
        onClick={() => setVisible(true)}
        aria-label="Show Performance Monitor"
        title="Show Performance Monitor (press ` to toggle)"
      >
        <ActivityIcon size={15} />
      </button>
    );
  }

  const { fps: displayFps, frameTime, jsHeap, domNodes, tracking } = perfData;

  return (
    <div className="perf-monitor" role="region" aria-label="Performance Monitor">
      <div className="perf-header">
        <span className="perf-header-title">
          <ActivityIcon size={12} />
          Telemetry
        </span>
        <button
          type="button"
          className="perf-close"
          onClick={() => setVisible(false)}
          aria-label="Close Performance Monitor"
        >
          <XIcon size={12} />
        </button>
      </div>
      <div className="perf-body">
        <PerfRow label="FPS" value={String(displayFps)} warning={displayFps < 20} />
        <PerfRow label="Frame" value={`${frameTime} ms`} warning={frameTime > 50} />
        <PerfRow label="Inference" value={`${inferenceTime} ms`} warning={inferenceTime > 30} />
        <PerfRow label="JS Heap" value={jsHeap} />
        <PerfRow label="DOM Nodes" value={String(domNodes)} />
        <PerfRow label="Tracking" value={tracking ? 'LIVE' : 'PAUSED'} />
        <div className="perf-sparkline" aria-hidden="true">
          {history.map((v, i) => (
            <div
              key={`${i}-${v}`}
              className="perf-spark-bar"
              style={{
                height: `${Math.max(12, Math.min((v / 60) * 100, 100))}%`,
                backgroundColor:
                  v < 20 ? 'var(--rose)' : v < 40 ? 'var(--amber)' : 'var(--emerald)',
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
