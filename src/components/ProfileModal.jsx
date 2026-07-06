import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { X, Check, User, Camera } from 'lucide-react';

const PRESETS = [
  { name: 'Aurora', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aurora' },
  { name: 'Cosmo', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Cosmo' },
  { name: 'Vortex', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=Vortex' },
  { name: 'Stardust', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Stardust' },
  { name: 'Phoenix', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Phoenix' },
  { name: 'Nebula', url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Nebula' },
];

export default function ProfileModal({ isOpen, onClose }) {
  const { currentUser, updateUserProfile, firebaseActive } = useAuth();
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [selectedPhoto, setSelectedPhoto] = useState(currentUser?.photoURL || '');
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 2 * 1024 * 1024) {
        return setError('Image file must be under 2MB.');
      }
      setFile(selectedFile);
      setSelectedPhoto(URL.createObjectURL(selectedFile));
      setError('');
    }
  };

  const handleUpload = () => {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(selectedPhoto);
      if (!firebaseActive) {
        // Fallback for demo mode - use the local object URL or convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
        return;
      }

      setIsUploading(true);
      const storageRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error(error);
          setIsUploading(false);
          reject(new Error('Failed to upload file to storage.'));
        },
        async () => {
          try {
            const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
            setIsUploading(false);
            resolve(downloadUrl);
          } catch (e) {
            setIsUploading(false);
            reject(e);
          }
        }
      );
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      return setError('Display name cannot be empty.');
    }

    setIsSubmitting(true);
    setError('');

    try {
      const finalPhotoURL = await handleUpload();
      await updateUserProfile(displayName.trim(), finalPhotoURL);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay animate-fade-in">
      <div className="modal-content glass-panel border border-slate-800 animate-slide-up relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
          <User size={20} className="text-indigo-400" />
          Edit Profile
        </h2>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Avatar Preview & Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', width: '100%' }}>
            <div style={{ position: 'relative', width: '96px', height: '96px' }}>
              <img
                src={selectedPhoto}
                alt="Avatar Preview"
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  border: '2px solid var(--accent-primary)',
                  objectFit: 'cover',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              />
              <label 
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  padding: '6px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-glow)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <Camera size={14} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            
            <p className="text-[11px] text-slate-500">
              Upload custom image (Max 2MB) or choose a designer preset below
            </p>

            {/* Presets Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', width: '100%', marginTop: '8px' }}>
              {PRESETS.map((preset) => {
                const isSelected = selectedPhoto === preset.url && !file;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setSelectedPhoto(preset.url);
                    }}
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '1 / 1',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: isSelected ? '2px solid var(--accent-primary)' : '2px solid rgba(255,255,255,0.05)',
                      backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.1)' : 'rgba(18, 24, 38, 0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px',
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                    title={preset.name}
                  >
                    <img 
                      src={preset.url} 
                      alt={preset.name} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                    />
                    {isSelected && (
                      <div 
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <Check size={12} className="text-white" style={{ strokeWidth: 3 }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="User display name"
                className="w-full glass-input"
                maxLength={25}
                required
              />
            </div>
          </div>

          {/* Progress Bar for files */}
          {isUploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Uploading Image...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-6"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
