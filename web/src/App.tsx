import React, { useRef, useEffect } from 'react';
import { useVtuber } from './hooks/useVtuber';

const App: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { init, status, isLoaded, error, inferenceTime, fps, progress } = useVtuber();
    const initStarted = useRef(false);

    useEffect(() => {
        if (videoRef.current && !initStarted.current) {
            initStarted.current = true;
            init(videoRef.current);
        }
    }, [init]);

    return (
        <div className="container">
            {!isLoaded && (
                <div className="overlay">
                    <div className="spinner"></div>
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <h2>{status}</h2>
                    {error && (
                        <div className="error-container">
                            <p className="error">{error}</p>
                            <button className="btn-primary" onClick={() => window.location.reload()}>
                                SYSTEM RESTORE
                            </button>
                        </div>
                    )}
                </div>
            )}

            <aside className="sidebar">
                <div className="logo">EasyVtuber V2 🌸</div>
                
                <div className="system-status">
                    <div className="status-badge">TS/WASM ELITE CORE</div>
                </div>

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
        </div>
    );
};

export default App;
