import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isGuest: boolean;
    setAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true, 
    isGuest: false,
    setAsGuest: () => {}
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);

    const setAsGuest = () => {
        setIsGuest(true);
        setLoading(false);
    };

    useEffect(() => {
        if (!isFirebaseConfigured) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isGuest, setAsGuest }}>
            {children}
        </AuthContext.Provider>
    );
};
