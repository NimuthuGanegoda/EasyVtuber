import { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-webgpu';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { extractPose } from '../utils/poseExtractor';

// Elite performance constants
const MODEL_BASE = './data/'; // Corrected for root deployment
const MP_VERSION = '0.10.35';
const FACE_LANDMARKER_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;

export function useVtuber() {
    const [status, setStatus] = useState('Resonating with the Ley Lines...');
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inferenceTime, setInferenceTime] = useState(0);
    const [fps, setFps] = useState(0);
    const [progress, setProgress] = useState(0);

    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const faceModelRef = useRef<tf.LayersModel | null>(null);
    const bodyModelRef = useRef<tf.LayersModel | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const requestRef = useRef<number>();

    const init = async (videoElement: HTMLVideoElement) => {
        const startTime = performance.now();
        try {
            setStatus('Initializing Neural Engines...');
            setProgress(10);
            
            // Parallel initialization of TF.js and MediaPipe
            const [filesetResolver] = await Promise.all([
                FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM),
                tf.ready(),
                tf.setBackend('webgl') // Default to WebGL for stability, user can switch to WebGPU
            ]);

            setStatus('Synchronizing Neural Cores...');
            setProgress(30);

            const char = 'lambda_chan';
            // Parallel load all models
            const [landmarker, faceModel, bodyModel] = await Promise.all([
                FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: `${MODEL_BASE}face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: true,
                    runningMode: "VIDEO",
                    numFaces: 1
                }),
                tf.loadLayersModel(`${MODEL_BASE}${char}/face_morpher.json`).catch(() => null),
                tf.loadLayersModel(`${MODEL_BASE}${char}/body_morpher.json`).catch(() => null)
            ]);

            faceLandmarkerRef.current = landmarker;
            faceModelRef.current = faceModel;
            bodyModelRef.current = bodyModel;

            if (!faceModel || !bodyModel) {
                console.warn('Neural Core models missing. Entering Tracking-Only mode.');
                setStatus('Tracking Only Mode Active');
            } else {
                setStatus('Elite Core Synchronized');
            }

            setProgress(80);
            setStatus('Calibrating Optical Input...');

            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                } 
            });

            videoElement.srcObject = stream;
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                videoRef.current = videoElement;
                setIsLoaded(true);
                setProgress(100);
                const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
                setStatus(`Eternity Initiated in ${totalTime}s`);
                requestRef.current = requestAnimationFrame(loop);
            };

        } catch (err: any) {
            console.error('Boot Failure:', err);
            setError(`Boot Failure: ${err.message}`);
            setStatus('System Restoration Required');
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

    return { init, status, isLoaded, error, inferenceTime, fps, progress };
}
