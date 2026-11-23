import { useCallback, useEffect, useRef, useState } from 'react';

export interface StageRecorderState {
  isRecording: boolean;
  durationSec: number;
  error: string | null;
  supported: boolean;
  startRecording: (canvas: HTMLCanvasElement | null, audioStream?: MediaStream | null) => void;
  stopRecording: () => void;
}

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? '';
}

/**
 * Records the live VTuber stage canvas (plus optional mic audio) directly to a
 * downloadable WebM clip via MediaRecorder.
 */
export function useStageRecorder(): StageRecorderState {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);

  const supported =
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function';

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearTimer();
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
    setIsRecording(false);
  }, [clearTimer]);

  const startRecording = useCallback(
    (canvas: HTMLCanvasElement | null, audioStream?: MediaStream | null) => {
      if (!supported) {
        setError('Video recording is not supported in this browser.');
        return;
      }
      if (!canvas) {
        setError('Stage canvas is not ready yet.');
        return;
      }
      setError(null);
      try {
        const videoStream = canvas.captureStream(30);
        const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
        if (audioStream) {
          audioStream.getAudioTracks().forEach((track) => tracks.push(track));
        }
        const combined = new MediaStream(tracks);
        const mimeType = pickSupportedMimeType();
        const recorder = new MediaRecorder(combined, mimeType ? { mimeType } : undefined);

        chunksRef.current = [];
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) {
            chunksRef.current.push(ev.data);
          }
        };
        recorder.onstop = () => {
          clearTimer();
          setIsRecording(false);
          const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' });
          chunksRef.current = [];
          if (blob.size > 0) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `easyvtuber-clip-${Date.now()}.webm`;
            a.click();
            window.setTimeout(() => URL.revokeObjectURL(url), 5000);
          }
          videoStream.getTracks().forEach((t) => t.stop());
        };
        recorder.onerror = () => {
          clearTimer();
          setIsRecording(false);
          setError('Recording interrupted by browser encoder.');
        };

        recorderRef.current = recorder;
        recorder.start(250);
        startedAtRef.current = Date.now();
        setDurationSec(0);
        setIsRecording(true);
        timerRef.current = window.setInterval(() => {
          setDurationSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
        }, 500);
      } catch (err) {
        clearTimer();
        setIsRecording(false);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [supported, clearTimer],
  );

  useEffect(() => {
    return () => {
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    };
  }, [clearTimer]);

  return {
    isRecording,
    durationSec,
    error,
    supported,
    startRecording,
    stopRecording,
  };
}
