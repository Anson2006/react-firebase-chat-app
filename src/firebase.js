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

export const parseFirebaseConfigText = (text) => {
  if (!text) return null;
  const cleanInput = text.trim();
  
  const extractValue = (key) => {
    // Matches key: "value", "key": 'value', key = `value`, etc.
    const regex = new RegExp(`(?:["'\`]?${key}["'\`]?)\\s*[:=]\\s*["'\`]([^"'\`]+)["'\`]`);
    const match = cleanInput.match(regex);
    return match ? match[1].trim() : null;
  };

  const config = {
    apiKey: extractValue('apiKey'),
    authDomain: extractValue('authDomain'),
    projectId: extractValue('projectId'),
    storageBucket: extractValue('storageBucket'),
    messagingSenderId: extractValue('messagingSenderId'),
    appId: extractValue('appId')
  };

  // If the parsing fails to find the fields, check if the input is raw JSON
  if (!config.apiKey || !config.projectId) {
    try {
      // Find JSON block
      let jsonStr = cleanInput;
      if (jsonStr.includes('{')) {
        const start = jsonStr.indexOf('{');
        const end = jsonStr.lastIndexOf('}') + 1;
        jsonStr = jsonStr.slice(start, end);
      }
      const parsed = JSON.parse(jsonStr);
      if (parsed.apiKey) config.apiKey = parsed.apiKey;
      if (parsed.authDomain) config.authDomain = parsed.authDomain;
      if (parsed.projectId) config.projectId = parsed.projectId;
      if (parsed.storageBucket) config.storageBucket = parsed.storageBucket;
      if (parsed.messagingSenderId) config.messagingSenderId = parsed.messagingSenderId;
      if (parsed.appId) config.appId = parsed.appId;
    } catch {
      // Ignore JSON parse errors, fall back to regex matches
    }
  }

  return config;
};

export const validateFirebaseConfig = (config) => {
  if (!config) return { isValid: false, error: 'Configuration is empty.' };
  
  const required = ['apiKey', 'projectId'];
  for (const key of required) {
    if (!config[key] || config[key].trim() === '') {
      return { isValid: false, error: `Missing required field: ${key}` };
    }
  }

  const isPlaceholder = (val) => {
    if (!val) return false;
    const v = val.toLowerCase().trim();
    return (
      v === 'your_api_key' ||
      v === 'your_project_id' ||
      v === 'your_auth_domain' ||
      v === 'your_storage_bucket' ||
      v === 'your_messaging_sender_id' ||
      v === 'your_app_id' ||
      v.includes('yourkeyhere') ||
      v.includes('placeholder')
    );
  };

  for (const key in config) {
    if (isPlaceholder(config[key])) {
      return { isValid: false, error: `Field "${key}" contains a placeholder value. Please configure your actual Firebase credentials.` };
    }
  }

  return { isValid: true };
};

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
const validation = validateFirebaseConfig(config);

if (config && validation.isValid) {
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

const enableFirebase = () => {
  try {
    localStorage.removeItem('firebase_disabled');
    window.location.reload();
  } catch (e) {
    console.error('Error enabling firebase:', e);
  }
};

export { app, auth, db, storage, googleProvider, isFirebaseConfigured, enableFirebase };
