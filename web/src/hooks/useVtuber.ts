import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { extractPose } from '../utils/poseExtractor';

const MODEL_BASE = '../data/';
const FACE_LANDMARKER_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

export function useVtuber() {
    const [status, setStatus] = useState('Awaiting Initiation');
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inferenceTime, setInferenceTime] = useState(0);
    const [fps, setFps] = useState(0);

    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const faceModelRef = useRef<tf.LayersModel | null>(null);
    const bodyModelRef = useRef<tf.LayersModel | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const requestRef = useRef<number>();

    const init = async (videoElement: HTMLVideoElement) => {
        try {
            setStatus('Loading MediaPipe...');
            const filesetResolver = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM);
            faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: `${MODEL_BASE}face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: "VIDEO",
                numFaces: 1
            });

            setStatus('Loading Neural Core...');
            const char = 'lambda_chan';
            faceModelRef.current = await tf.loadLayersModel(`${MODEL_BASE}${char}/face_morpher.json`);
            bodyModelRef.current = await tf.loadLayersModel(`${MODEL_BASE}${char}/body_morpher.json`);

            setStatus('Activating Camera...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480 } 
            });
            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                videoRef.current = videoElement;
                setIsLoaded(true);
                setStatus('System Online');
                requestRef.current = requestAnimationFrame(loop);
            };

        } catch (err: any) {
            setError(err.message);
            setStatus('System Failure');
        }
    };

    const loop = async () => {
        if (!videoRef.current || !faceLandmarkerRef.current) return;

        const startTime = performance.now();
        const results = faceLandmarkerRef.current.detectForVideo(videoRef.current, startTime);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const pose = extractPose(results.faceLandmarks[0]);
            // TODO: Run TF.js inference with extracted pose
        }

        const endTime = performance.now();
        setInferenceTime(Math.round(endTime - startTime));
        setFps(Math.round(1000 / (endTime - startTime)));

        requestRef.current = requestAnimationFrame(loop);
    };

    useEffect(() => {
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, []);

    return { init, status, isLoaded, error, inferenceTime, fps };
}
