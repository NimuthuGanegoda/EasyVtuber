import { useCallback, useEffect, useRef, useState } from 'react';
import { computeAudioMouthEnvelope } from '../utils/trackingFilters';

export interface AudioLipSyncState {
  enabled: boolean;
  level: number;
  sensitivity: number;
  noiseGate: number;
  error: string | null;
  levelRef: React.MutableRefObject<number>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
  setSensitivity: (value: number) => void;
  setNoiseGate: (value: number) => void;
}

/**
 * Real-time microphone lip-sync powered by the Web Audio API AnalyserNode.
 * Drives `levelRef` at display refresh rate for zero-jank rendering and syncs
 * throttled VU bar updates to React state.
 */
export function useAudioLipSync(): AudioLipSyncState {
  const [enabled, setEnabled] = useState(false);
  const [level, setLevel] = useState(0);
  const [sensitivity, setSensitivityState] = useState(2.2);
  const [noiseGate, setNoiseGateState] = useState(0.02);
  const [error, setError] = useState<string | null>(null);

  const levelRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef(0);
  const sensitivityRef = useRef(sensitivity);
  const noiseGateRef = useRef(noiseGate);

  const setSensitivity = useCallback((value: number) => {
    const clamped = Math.max(0.5, Math.min(8, value));
    sensitivityRef.current = clamped;
    setSensitivityState(clamped);
  }, []);

  const setNoiseGate = useCallback((value: number) => {
    const clamped = Math.max(0, Math.min(0.2, value));
    noiseGateRef.current = clamped;
    setNoiseGateState(clamped);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (ctxRef.current) {
      void ctxRef.current.close().catch(() => {});
      ctxRef.current = null;
    }
    analyserRef.current = null;
    levelRef.current = 0;
    setLevel(0);
    setEnabled(false);
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone API unavailable in this browser context.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      const AudioCtx = window.AudioContext;
      const audioCtx = new AudioCtx();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      streamRef.current = stream;
      ctxRef.current = audioCtx;
      analyserRef.current = analyser;
      setEnabled(true);

      const buffer = new Float32Array(analyser.fftSize);
      let lastUiSync = 0;
      const sample = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);
        const { mouth } = computeAudioMouthEnvelope(
          buffer,
          levelRef.current,
          sensitivityRef.current,
          noiseGateRef.current,
        );
        levelRef.current = mouth;
        const now = performance.now();
        if (now - lastUiSync > 60) {
          lastUiSync = now;
          setLevel(mouth);
        }
        rafRef.current = requestAnimationFrame(sample);
      };
      rafRef.current = requestAnimationFrame(sample);
    } catch (err) {
      stop();
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied.'
          : err instanceof Error
            ? err.message
            : String(err);
      setError(msg);
    }
  }, [stop]);

  const toggle = useCallback(() => {
    if (enabled) {
      stop();
    } else {
      void start();
    }
  }, [enabled, start, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    enabled,
    level,
    sensitivity,
    noiseGate,
    error,
    levelRef,
    streamRef,
    start,
    stop,
    toggle,
    setSensitivity,
    setNoiseGate,
  };
}
