import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GithubAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
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
                    <button type="submit" className="btn-primary">
                        {isRegistering ? 'EMERGE' : 'ASCEND'}
                    </button>
                </form>

                <div className="divider"><span>OR</span></div>

                <button onClick={handleGithubLogin} className="btn-github">
                    SIGN IN WITH GITHUB
                </button>

                {error && <div className="login-error">{error}</div>}

                <div className="login-footer">
                    <button onClick={() => setIsRegistering(!isRegistering)}>
                        {isRegistering ? 'Already have an account? Sign In' : 'New here? Register your Soul'}
                    </button>
                </div>
            </div>

            <style>{`
                .login-overlay {
                    position: fixed; inset: 0;
                    background: radial-gradient(circle at center, #1a1a1f 0%, #0a0a0c 100%);
                    z-index: 5000;
                    display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                }
                .login-card {
                    width: 100%; max-width: 420px;
                    background: rgba(20, 20, 25, 0.95);
                    backdrop-filter: blur(20px);
                    border: 1px solid rgba(255, 105, 180, 0.15);
                    border-radius: 32px;
                    padding: 40px;
                    box-shadow: 0 40px 100px rgba(0,0,0,0.8);
                    text-align: center;
                }
                .login-header h1 { font-size: 28px; margin: 0; color: #ffc0cb; letter-spacing: -1px; }
                .login-header p { font-size: 14px; color: rgba(255,255,255,0.5); margin: 10px 0 30px; }
                .login-form { display: flex; flex-direction: column; gap: 15px; }
                .login-form input {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    padding: 14px; color: white; outline: none;
                    transition: border-color 0.3s;
                }
                .login-form input:focus { border-color: #ff69b4; }
                .divider { margin: 25px 0; border-bottom: 1px solid rgba(255,255,255,0.1); position: relative; }
                .divider span { position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #141419; padding: 0 10px; font-size: 10px; color: rgba(255,255,255,0.3); }
                .btn-github {
                    width: 100%; background: #24292e; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 600; cursor: pointer;
                }
                .login-error { margin-top: 20px; color: #ff4757; font-size: 12px; }
                .login-footer { margin-top: 30px; }
                .login-footer button { background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 12px; text-decoration: underline; }
            `}</style>
        </div>
    );
};
