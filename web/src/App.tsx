import React, { useRef } from 'react';
import { useVtuber } from './hooks/useVtuber';

const App: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { init, status, isLoaded, error, inferenceTime, fps } = useVtuber();

    const handleStart = () => {
        if (videoRef.current) {
            init(videoRef.current);
        }
    };

    return (
        <div className="container">
            {!isLoaded && (
                <div className="overlay">
                    <div className="spinner"></div>
                    <h2>{status}</h2>
                    {error && <p className="error">{error}</p>}
                    <button className="btn-primary" onClick={handleStart}>
                        INITIATE ETERNITY
                    </button>
                </div>
            )}

            <aside className="sidebar">
                <div className="logo">EasyVtuber V2 🌸</div>
                <div className="status-badge">TS/WASM ELITE</div>
                
                <div className="stats">
                    <div className="stat-item">
                        <span>Inference:</span> {inferenceTime}ms
                    </div>
                    <div className="stat-item">
                        <span>FPS:</span> {fps}
                    </div>
                </div>
            </aside>

            <main className="main-content">
                <div className="viewport">
                    <video ref={videoRef} className="input-video" />
                    <div className="render-area">
                        {/* Render Canvas will go here */}
                        <div className="placeholder">
                            {isLoaded ? 'Tracking Active...' : 'System Offline'}
                        </div>
                    </div>
                </div>
            </main>

            <style>{`
                :root {
                    --primary: #ffc0cb;
                    --accent: #ff69b4;
                    --dark-bg: #0a0a0c;
                }
                body {
                    margin: 0;
                    background: var(--dark-bg);
                    color: white;
                    font-family: 'Inter', sans-serif;
                }
                .container { display: flex; height: 100vh; }
                .sidebar {
                    width: 300px;
                    background: rgba(20,20,25,0.9);
                    padding: 30px;
                    border-right: 1px solid rgba(255,255,255,0.1);
                }
                .main-content { flex: 1; display: flex; align-items: center; justify-content: center; }
                .viewport { display: flex; gap: 30px; }
                .input-video { width: 320px; border-radius: 20px; background: #000; }
                .render-area { width: 512px; height: 512px; border-radius: 20px; border: 1px solid var(--accent); display: flex; align-items: center; justify-content: center; }
                .overlay { position: fixed; inset: 0; background: var(--dark-bg); z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .btn-primary { background: var(--accent); border: none; padding: 15px 40px; border-radius: 10px; color: white; font-weight: bold; cursor: pointer; margin-top: 20px; }
            `}</style>
        </div>
    );
};

export default App;
