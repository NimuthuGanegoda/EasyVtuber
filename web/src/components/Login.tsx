import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GithubAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { setAsGuest } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFirebaseConfigured) {
            setError("Firebase not configured. Please use Guest Mode or set VITE_FIREBASE_API_KEY.");
            return;
        }
        setError(null);
        try {
            if (isRegistering) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleGithubLogin = async () => {
        if (!isFirebaseConfigured) {
            setError("Firebase not configured. Please use Guest Mode.");
            return;
        }
        const provider = new GithubAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div className="login-overlay">
            <div className="login-card">
                <div className="login-header">
                    <h1>{isRegistering ? 'Register your Soul' : 'Prove your Worth'}</h1>
                    <p>Enter the Sanctuary of Eternity</p>
                </div>

                {!isFirebaseConfigured && (
                    <div className="config-warning">
                        🛡️ Backend in Offline Mode
                    </div>
                )}

                <form onSubmit={handleSubmit} className="login-form">
                    <input 
                        type="email" 
                        placeholder="Email Address" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                    />
                    <input 
                        type="password" 
                        placeholder="Secret Key" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                    />
                    <button type="submit" className="btn-primary" disabled={!isFirebaseConfigured}>
                        {isRegistering ? 'EMERGE' : 'ASCEND'}
                    </button>
                </form>

                <div className="divider"><span>OR</span></div>

                <div className="button-group">
                    <button onClick={handleGithubLogin} className="btn-github" disabled={!isFirebaseConfigured}>
                        SIGN IN WITH GITHUB
                    </button>
                    
                    <button onClick={setAsGuest} className="btn-guest">
                        ENTER AS GUEST
                    </button>
                </div>

                {error && <div className="login-error">{error}</div>}

                <div className="login-footer">
                    <button onClick={() => setIsRegistering(!isRegistering)} disabled={!isFirebaseConfigured}>
                        {isRegistering ? 'Already have an account? Sign In' : 'New here? Register your Soul'}
                    </button>
                </div>
            </div>
        </div>
    );
};
