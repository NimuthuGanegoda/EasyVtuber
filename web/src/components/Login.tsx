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
        </div>
    );
};
