/// <reference lib="webworker" />

// Web Worker for offloading face pose extraction from the main thread.
// Receives raw MediaPipe FaceLandmarker landmarks, computes pose data,
// and posts back either the result or a human-readable error.
//
// Protocol: one message in, exactly one message out, carrying the same `id`.
// The main thread keeps at most one frame in flight (see useVtuber), so `id`
// lets it drop anything stale.

import { extractPose, Landmark } from './poseExtractor';

export interface PoseWorkerMessage {
  id: number;
  landmarks: Landmark[];
  blendshapes?: Record<string, number>;
  transformMatrix?: number[];
}

export interface PoseWorkerResult {
  id: number;
  pose?: ReturnType<typeof extractPose>;
  error?: string;
  timestamp: number;
}

/**
 * `typeof WorkerGlobalScope !== 'undefined'` alone is not enough to tell a
 * worker from a window: the previous `'postMessage' in self` check is *also*
 * true on `window`, so importing this module from the main thread would have
 * hijacked `window.onmessage`.
 */
const isWorkerScope =
  typeof WorkerGlobalScope !== 'undefined' &&
  typeof self !== 'undefined' &&
  self instanceof WorkerGlobalScope;

if (isWorkerScope) {
  const ctx = self as unknown as DedicatedWorkerGlobalScope;

  ctx.onmessage = (event: MessageEvent<PoseWorkerMessage>) => {
    const { id, landmarks, blendshapes, transformMatrix } = event.data ?? { id: 0 };

    try {
      const pose = extractPose(landmarks ?? [], blendshapes, transformMatrix);
      const result: PoseWorkerResult = { id, pose, timestamp: performance.now() };
      ctx.postMessage(result);
    } catch (err) {
      // Report the failure instead of dropping the frame silently — the main
      // thread surfaces this to the user.
      const result: PoseWorkerResult = {
        id,
        error: err instanceof Error ? err.message : String(err),
        timestamp: performance.now(),
      };
      ctx.postMessage(result);
    }
  };
}

// Export a no-op for tree-shaking (the actual worker logic runs via onmessage)
export {};
