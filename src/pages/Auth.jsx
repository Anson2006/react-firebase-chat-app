import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { saveFirebaseConfig, clearFirebaseConfig } from '../firebase';
import { Mail, Lock, User, LogIn, Database, Sparkles, Eye, EyeOff, CheckCircle } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22c-.87-2.6-2.87-4.53-6.16-4.53z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
  </svg>
);

export default function Auth() {
  const { login, signup, loginWithGoogle, firebaseActive } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Firebase Config Setup state
  const [showConfigConsole, setShowConfigConsole] = useState(false);
  const [configInput, setConfigInput] = useState('');
  const [configError, setConfigError] = useState('');
  const [configSuccess, setConfigSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password || (isRegister && !username)) {
      return setError('Please fill in all required fields.');
    }
    
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        await signup(email, password, username);
      } else {
        await login(email, password);
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Email is already registered.');
      } else if (err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigSubmit = (e) => {
    e.preventDefault();
    setConfigError('');
    setConfigSuccess(false);

    try {
      // Find the JSON object inside the input
      let cleanInput = configInput.trim();
      
      // If they paste the entire code block: const firebaseConfig = { ... }
      if (cleanInput.includes('{')) {
        const start = cleanInput.indexOf('{');
        const end = cleanInput.lastIndexOf('}') + 1;
        cleanInput = cleanInput.slice(start, end);
      }

      // Convert Javascript-like object keys to valid JSON (quotes around keys) if needed
      // A quick way is to evaluate it safely using Function, but to avoid security risks, 
      // we'll attempt a safe JSON-like evaluation or a clean Regex parse.
      // Since it's local config and input by the user on their own system, 
      // we can parse it as a JS object safely:
      const parsedConfig = new Function(`return ${cleanInput}`)();

      if (!parsedConfig.apiKey || !parsedConfig.projectId) {
        throw new Error('Config must contain at least apiKey and projectId.');
      }

      const success = saveFirebaseConfig(parsedConfig);
      if (success) {
        setConfigSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error('Failed to write to local storage.');
      }
    } catch (err) {
      console.error(err);
      setConfigError('Invalid configuration object. Please paste a valid Firebase configuration block.');
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      {/* Background blobs for premium glassmorphism */}
      <div className="bg-glowing-sphere-1"></div>
      <div className="bg-glowing-sphere-2"></div>

      <div className="w-full max-w-md glass-panel p-8 relative animate-slide-up shadow-lg">
        {/* Firebase Status Badge */}
        <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
          firebaseActive 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${firebaseActive ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
          {firebaseActive ? 'Firebase Active' : 'Demo Offline Mode'}
        </div>

        {/* Brand / Logo */}
        <div className="text-center mb-8 mt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-glow mb-4 text-white">
            <Sparkles size={28} className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">AuraChat</h1>
          <p className="text-sm text-slate-400 mt-1">Connect instantly in elegant rooms</p>
        </div>

        {/* Main Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm text-center">
              {error}
            </div>
          )}

          {isRegister && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Display Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <User size={18} />
                </span>
                <input
                  type="text"
                  placeholder="Alex Mercer"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full glass-input pl-10"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Mail size={18} />
              </span>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-input pl-10"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 mt-2 text-base font-semibold"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
            ) : (
              <>
                <LogIn size={18} />
                {isRegister ? 'Create Account' : 'Sign In'}
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="flex items-center my-6">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Or continue with</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        {/* Google OAuth */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full btn-secondary py-3 flex items-center justify-center gap-2.5 font-medium transition-all text-sm mb-4"
        >
          <GoogleIcon />
          {firebaseActive ? 'Google Account' : 'Demo Account (Instantly)'}
        </button>

        {/* Toggle between login/register */}
        <div className="text-center mt-6">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
            }}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* Expandable Firebase Configuration Console */}
        <div className="mt-8 border-t border-slate-800/60 pt-4">
          <button
            onClick={() => setShowConfigConsole(!showConfigConsole)}
            className="w-full flex items-center justify-between text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Database size={13} />
              {firebaseActive ? 'Modify Firebase Database' : 'Connect Firebase Realtime'}
            </span>
            <span className="underline">{showConfigConsole ? 'Hide Setup' : 'Configure'}</span>
          </button>

          {showConfigConsole && (
            <div className="mt-4 space-y-4 animate-fade-in">
              {firebaseActive && (
                <div className="pb-3 border-b border-slate-800/60">
                  <button
                    type="button"
                    onClick={clearFirebaseConfig}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-500/5 border border-red-500/15 text-xs text-rose-400 hover:bg-red-500/10 transition-colors font-medium"
                  >
                    <Database size={14} />
                    Disconnect Firebase (Use Demo Mode)
                  </button>
                </div>
              )}
              
              <form onSubmit={handleConfigSubmit} className="space-y-3">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {firebaseActive 
                    ? 'Or modify your current Web App Firebase Configuration:' 
                    : 'Paste your Web App Firebase Configuration object. You can grab this from the Firebase Console (Project Settings > General > Your Apps).'}
                </p>
                
                <textarea
                  placeholder={`const firebaseConfig = { \n  apiKey: "AIzaSy...", \n  authDomain: "chat-app.firebaseapp.com", \n  projectId: "chat-app", \n  storageBucket: "chat-app.appspot.com", \n  messagingSenderId: "123456", \n  appId: "1:123456:web:abcd" \n};`}
                  value={configInput}
                  onChange={(e) => setConfigInput(e.target.value)}
                  className="w-full glass-input h-28 text-[11px] font-mono leading-normal p-3 resize-none bg-black/20"
                  required
                ></textarea>

                {configError && (
                  <div className="bg-rose-500/10 text-rose-400 border border-rose-500/10 p-2 rounded-lg text-[11px]">
                    {configError}
                  </div>
                )}

                {configSuccess && (
                  <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 p-2 rounded-lg text-[11px] flex items-center gap-1.5">
                    <CheckCircle size={14} />
                    Connected! Reloading app...
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full btn-secondary py-2 text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border-indigo-500/20"
                >
                  Save & Connect Realtime
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
