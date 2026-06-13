import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if configuration is actually provided
export const isFirebaseConfigured = !!(firebaseConfig.apiKey && firebaseConfig.apiKey !== "placeholder-key");

let app;
if (!getApps().length) {
    // Only initialize if we have config, otherwise use a dummy app or handle in context
    app = initializeApp(isFirebaseConfigured ? firebaseConfig : {
        apiKey: "unconfigured",
        authDomain: "unconfigured",
        projectId: "unconfigured",
        storageBucket: "unconfigured",
        messagingSenderId: "000000000000",
        appId: "unconfigured"
    });
} else {
    app = getApp();
}

export const auth = getAuth(app);
export const db = getFirestore(app);
