import React, { useRef } from 'react';
import { useVtuber } from './hooks/useVtuber';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { auth } from './firebase';

const MainApp: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { init, status, isLoaded, error, inferenceTime, fps, progress } = useVtuber();
    const { user, loading } = useAuth();

    if (loading) return <div className="loading-screen">Resonating with the Ley Lines...</div>;
    if (!user) return <Login />;

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
                    <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                    </div>
                    <h2>{status}</h2>
                    {error && <p className="error">{error}</p>}
                    <button className="btn-primary" onClick={handleStart}>
                        INITIATE ETERNITY
                    </button>
                </div>
            )}

            <aside className="sidebar">
                <div className="logo">EasyVtuber V2 🌸</div>
                
                <div className="user-profile">
                    <img src={user.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=Miko'} alt="Soul" />
                    <div className="user-info">
                        <span className="user-name">{user.displayName || 'Elite User'}</span>
                        <span className="user-email">{user.email}</span>
                    </div>
                    <button onClick={() => auth.signOut()} className="btn-logout">🚪</button>
                </div>

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
                .loading-screen { height: 100vh; display: flex; align-items: center; justify-content: center; background: #0a0a0c; color: #ffc0cb; font-weight: 800; letter-spacing: 2px; }
                .container { display: flex; height: 100vh; }
                .sidebar {
                    width: 340px;
                    background: rgba(20,20,25,0.9);
                    padding: 30px;
                    border-right: 1px solid rgba(255,255,255,0.1);
                    display: flex; flex-direction: column; gap: 30px;
                }
                .user-profile {
                    display: flex; align-items: center; gap: 15px; background: rgba(255,255,255,0.05); padding: 15px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.05);
                }
                .user-profile img { width: 45px; height: 45px; border-radius: 12px; border: 2px solid var(--accent); }
                .user-info { display: flex; flex-direction: column; flex: 1; overflow: hidden; }
                .user-name { font-weight: 700; font-size: 14px; color: var(--primary); }
                .user-email { font-size: 10px; color: rgba(255,255,255,0.4); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
                .btn-logout { background: none; border: none; font-size: 18px; cursor: pointer; opacity: 0.5; transition: opacity 0.3s; }
                .btn-logout:hover { opacity: 1; }
                
                .progress-bar { width: 300px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-bottom: 20px; overflow: hidden; }
                .progress-fill { height: 100%; background: var(--accent); transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px var(--accent); }

                .main-content { flex: 1; display: flex; align-items: center; justify-content: center; }
                .viewport { display: flex; gap: 30px; }
                .input-video { width: 320px; border-radius: 24px; background: #000; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
                .render-area { width: 512px; height: 512px; border-radius: 32px; border: 1px solid rgba(255,105,180,0.2); background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; box-shadow: 0 30px 80px rgba(0,0,0,0.6); }
                .overlay { position: fixed; inset: 0; background: var(--dark-bg); z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; }
                .btn-primary { background: linear-gradient(135deg, var(--accent), #ff1493); border: none; padding: 18px 50px; border-radius: 15px; color: white; font-weight: 800; cursor: pointer; margin-top: 30px; box-shadow: 0 10px 25px rgba(255,20,147,0.3); transition: transform 0.3s; }
                .btn-primary:hover { transform: translateY(-3px); }
            `}</style>
        </div>
    );
};

const App: React.FC = () => (
    <AuthProvider>
        <MainApp />
    </AuthProvider>
);

export default App;
