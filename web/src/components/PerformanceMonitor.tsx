import { useEffect, useRef, useState } from 'react';

interface PerfData {
  fps: number;
  inferenceTime: number;
  frameTime: number;
  jsHeap: string;
  domNodes: number;
  tracking: boolean;
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
  const lastFrameRef = useRef(performance.now());
  const animRef = useRef(0);
  const fpsHistoryRef = useRef<number[]>([]);
  // Use refs for changing props to avoid re-creating the RAF loop every 50ms
  const fpsRef = useRef(fps);
  const inferRef = useRef(inferenceTime);
  const trackingRef = useRef(isTracking);
  fpsRef.current = fps;
  inferRef.current = inferenceTime;
  trackingRef.current = isTracking;

  // Stable RAF loop — reads from refs, not stale closures
  useEffect(() => {
    let running = true;
    const update = () => {
      if (!running) return;
      const now = performance.now();
      const frameTime = now - lastFrameRef.current;
      lastFrameRef.current = now;

      const currentFps = fpsRef.current;
      fpsHistoryRef.current.push(currentFps);
      fpsHistoryRef.current = fpsHistoryRef.current.slice(-30);
      const avgFps =
        fpsHistoryRef.current.reduce((a, b) => a + b, 0) /
        Math.max(fpsHistoryRef.current.length, 1);

      let jsHeap = 'N/A';
      const mem = (performance as any).memory;
      if (mem) {
        jsHeap = `${(mem.usedJSHeapSize / 1048576).toFixed(1)} MB`;
      }

      setPerfData({
        fps: Math.round(avgFps),
        inferenceTime: inferRef.current,
        frameTime: Math.round(frameTime),
        jsHeap,
        domNodes: document.querySelectorAll('*').length,
        tracking: trackingRef.current,
      });

      animRef.current = requestAnimationFrame(update);
    };

    animRef.current = requestAnimationFrame(update);
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Toggle with backtick key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setVisible(v => !v);
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
        <PerfRow
          label="Frame"
          value={`${frameTime}ms`}
          warning={frameTime > 50}
        />
        <PerfRow
          label="Inference"
          value={`${inferenceTime}ms`}
          warning={inferenceTime > 30}
        />
        <PerfRow label="Heap" value={jsHeap} />
        <PerfRow label="DOM Nodes" value={String(domNodes)} />
        <PerfRow label="Tracking" value={tracking ? 'LIVE' : 'PAUSED'} />
        {/* Mini FPS sparkline */}
        <div className="perf-sparkline">
          {fpsHistoryRef.current.slice(-20).map((v, i) => (
            <div
              key={i}
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

function PerfRow({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className={`perf-row ${warning ? 'perf-warning' : ''}`}>
      <span className="perf-label">{label}</span>
      <span className="perf-value">{value}</span>
    </div>
  );
}
