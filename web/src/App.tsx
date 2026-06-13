import React, { useRef } from 'react';
import { useVtuber } from './hooks/useVtuber';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { auth } from './firebase';

const MainApp: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const { init, status, isLoaded, error, inferenceTime, fps, progress } = useVtuber();
    const { user, loading, isGuest } = useAuth();
    const initStarted = useRef(false);

    useEffect(() => {
        if ((user || isGuest) && videoRef.current && !initStarted.current) {
            initStarted.current = true;
            init(videoRef.current);
        }
    }, [user, isGuest, init]);

    if (loading) return <div className="loading-screen">Resonating with the Ley Lines...</div>;
    if (!user && !isGuest) return <Login />;

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
                    <img src={(user && user.photoURL) || 'https://api.dicebear.com/7.x/bottts/svg?seed=Miko'} alt="Soul" />
                    <div className="user-info">
                        <span className="user-name">{(user && (user.displayName || user.email)) || 'Elite Guest'}</span>
                        <span className="user-email">{isGuest ? 'Offline Sanctuary' : user?.email}</span>
                    </div>
                    <button onClick={() => isGuest ? window.location.reload() : auth.signOut()} className="btn-logout">
                        {isGuest ? '🔐' : '🚪'}
                    </button>
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
