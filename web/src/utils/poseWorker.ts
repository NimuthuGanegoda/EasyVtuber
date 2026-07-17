// Web Worker for offloading face pose extraction from the main thread.
// Receives raw MediaPipe FaceLandmarker landmarks, computes pose data,
// and posts back the result.

import { extractPose, Landmark } from './poseExtractor';

export interface PoseWorkerMessage {
  id: number;
  landmarks: Landmark[];
}

export interface PoseWorkerResult {
  id: number;
  pose: ReturnType<typeof extractPose>;
  timestamp: number;
}

// Worker self-reference for type safety
let workerSelf: DedicatedWorkerGlobalScope | null = null;

// Only run in worker context (skip during bundler module evaluation)
if (typeof self !== 'undefined' && 'postMessage' in self) {
  workerSelf = self as DedicatedWorkerGlobalScope;

  workerSelf.onmessage = (event: MessageEvent<PoseWorkerMessage>) => {
    const { id, landmarks } = event.data;

    if (!landmarks || landmarks.length === 0) {
      return;
    }

    try {
      const pose = extractPose(landmarks);
      const result: PoseWorkerResult = {
        id,
        pose,
        timestamp: performance.now(),
      };
      workerSelf!.postMessage(result);
    } catch (err) {
      // Silently ignore malformed landmark data
    }
  };
}

// Export a no-op for tree-shaking (the actual worker logic runs via self.onmessage)
export {};
