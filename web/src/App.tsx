import React, { useRef } from 'react';
import { useVtuber } from './hooks/useVtuber';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { auth } from './firebase';

const MainApp: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { init, status, isLoaded, error, inferenceTime, fps, progress } = useVtuber();
    const { user, loading } = useAuth();
    const initStarted = useRef(false);

    useEffect(() => {
        if (user && videoRef.current && !initStarted.current) {
            initStarted.current = true;
            init(videoRef.current);
        }
    }, [user, init]);

    if (loading) return <div className="loading-screen">Resonating with the Ley Lines...</div>;
    if (!user) return <Login />;

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
        </div>
    );
};

const App: React.FC = () => (
    <AuthProvider>
        <MainApp />
    </AuthProvider>
);

export default App;
