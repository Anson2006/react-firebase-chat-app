import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

let app = null;
let auth = null;
let db = null;
let storage = null;
let googleProvider = null;
let isFirebaseConfigured = false;

const loadFirebaseConfig = () => {
  try {
    const savedConfig = localStorage.getItem('firebase_config');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
  } catch (e) {
    console.error('Failed to parse saved firebase config:', e);
  }
  
  // Standard vite environment fallback
  if (import.meta.env.VITE_FIREBASE_API_KEY) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
  }
  return null;
};

const config = loadFirebaseConfig();

if (config && config.apiKey && config.projectId) {
  try {
    app = getApps().length === 0 ? initializeApp(config) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    googleProvider = new GoogleAuthProvider();
    isFirebaseConfigured = true;
  } catch (error) {
    console.error('Error initializing Firebase with config:', error);
  }
}

export const saveFirebaseConfig = (configObj) => {
  try {
    localStorage.setItem('firebase_config', JSON.stringify(configObj));
    localStorage.removeItem('firebase_disabled');
    return true;
  } catch (e) {
    console.error('Error saving firebase config:', e);
    return false;
  }
};

export const clearFirebaseConfig = () => {
  try {
    localStorage.removeItem('firebase_config');
    localStorage.setItem('firebase_disabled', 'true');
    window.location.reload();
  } catch (e) {
    console.error('Error clearing firebase config:', e);
  }
};

export { app, auth, db, storage, googleProvider, isFirebaseConfigured };
