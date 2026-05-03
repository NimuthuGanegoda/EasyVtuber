import * as tf from '@tensorflow/tfjs';
import { FaceLandmarker, FilesetResolver, Landmark } from '@mediapipe/tasks-vision';

// --- Configuration & State ---
const MODEL_BASE = '../data/';
const FACE_LANDMARKER_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';

let faceLandmarker: FaceLandmarker;
let faceModel: tf.LayersModel;
let bodyModel: tf.LayersModel;
let isRunning = false;
let lastVideoTime = -1;

// UI Elements
const video = document.getElementById('inputVideo') as HTMLVideoElement;
const canvasElement = document.getElementById('trackingCanvas') as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext('2d')!;
const renderCanvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const renderCtx = renderCanvas.getContext('2d')!;
const bootBtn = document.getElementById('bootBtn') as HTMLButtonElement;
const loadDetail = document.getElementById('loadDetail') as HTMLDivElement;
const loadingOverlay = document.getElementById('loadingOverlay') as HTMLDivElement;
const debugConsole = document.getElementById('debugConsole') as HTMLDivElement;
const inferenceTimeDisplay = document.getElementById('inferenceTime') as HTMLDivElement;
const fpsDisplay = document.getElementById('fpsNum') as HTMLDivElement;

function log(msg: string, type: 'info' | 'error' = 'info') {
    const time = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.style.color = type === 'error' ? '#ff4757' : '#00ff88';
    div.textContent = `[${time}] ${msg}`;
    debugConsole.appendChild(div);
    debugConsole.scrollTop = debugConsole.scrollHeight;
    console.log(`[Elite V2] ${msg}`);
}

// --- Initialization ---
async function init() {
    try {
        log('Initializing Elite Core V2...');
        loadDetail.textContent = 'Loading MediaPipe Wasm...';
        
        const filesetResolver = await FilesetResolver.forVisionTasks(FACE_LANDMARKER_WASM);
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: {
                modelAssetPath: `${MODEL_BASE}face_landmarker.task`,
                delegate: "GPU"
            },
            outputFaceBlendshapes: true,
            runningMode: "VIDEO",
            numFaces: 1
        });

        log('Face Landmarker Ready.');
        loadDetail.textContent = 'Loading Neural Models...';

        // Load TF.js Models (Lambda-chan default)
        const char = 'lambda_chan';
        faceModel = await tf.loadLayersModel(`${MODEL_BASE}${char}/face_morpher.json`);
        bodyModel = await tf.loadLayersModel(`${MODEL_BASE}${char}/body_morpher.json`);
        
        log('Neural Engine Initialized.');
        loadDetail.textContent = 'Activating Camera...';

        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        video.srcObject = stream;
        video.play();

        log('System Online.');
        loadingOverlay.style.opacity = '0';
        setTimeout(() => loadingOverlay.style.display = 'none', 800);
        
        isRunning = true;
        requestAnimationFrame(predictLoop);

    } catch (err: any) {
        log(`CRITICAL ERROR: ${err.message}`, 'error');
        loadDetail.textContent = 'BOOT FAILED. SEE CONSOLE.';
        debugConsole.style.display = 'block';
    }
}

// --- Processing Loop ---
async function predictLoop() {
    if (!isRunning) return;

    const startTime = performance.now();

    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = faceLandmarker.detectForVideo(video, startTime);

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            const landmarks = results.faceLandmarks[0];
            drawLandmarks(landmarks);
            
            // Here we would convert landmarks to model inputs
            // and run inference. For the prototype, we show tracking.
            // TODO: Port the pose extraction logic from Python to TS
        }
    }

    const endTime = performance.now();
    inferenceTimeDisplay.textContent = (endTime - startTime).toFixed(1);
    fpsDisplay.textContent = (1000 / (endTime - startTime)).toFixed(0);

    requestAnimationFrame(predictLoop);
}

function drawLandmarks(landmarks: Landmark[]) {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.fillStyle = '#ff69b4';
    for (const landmark of landmarks) {
        canvasCtx.beginPath();
        canvasCtx.arc(landmark.x * canvasElement.width, landmark.y * canvasElement.height, 1, 0, 2 * Math.PI);
        canvasCtx.fill();
    }
}

bootBtn.addEventListener('click', init);
document.getElementById('toggleDebugBtn')?.addEventListener('click', () => {
    debugConsole.style.display = debugConsole.style.display === 'none' ? 'block' : 'none';
});
