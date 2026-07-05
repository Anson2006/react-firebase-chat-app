import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { X, Hash, Info, Lock, Globe, Plus } from 'lucide-react';

export default function RoomModal({ isOpen, onClose, onRoomCreatedMock }) {
  const { currentUser, firebaseActive } = useAuth();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      return setError('Room name is required.');
    }
    if (isPrivate && !password.trim()) {
      return setError('Password is required for private rooms.');
    }

    setLoading(true);
    setError('');

    const newRoomData = {
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      displayName: name.trim(),
      description: description.trim(),
      isPrivate,
      password: isPrivate ? password : '',
      createdAt: firebaseActive ? serverTimestamp() : new Date().toISOString(),
      createdBy: currentUser.uid,
      creatorName: currentUser.displayName
    };

    try {
      if (firebaseActive) {
        const docRef = await addDoc(collection(db, 'rooms'), newRoomData);
        // Create an initial message in the room
        await addDoc(collection(db, `rooms/${docRef.id}/messages`), {
          text: `👋 welcome to the #${newRoomData.name} room! Created by ${currentUser.displayName}`,
          senderId: 'system',
          senderName: 'System',
          senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
          createdAt: serverTimestamp(),
          isSystem: true
        });
      } else {
        // Callback to add room locally in Demo Mode
        const mockId = 'mock_room_' + Math.random().toString(36).substring(2, 9);
        onRoomCreatedMock({
          id: mockId,
          ...newRoomData,
          createdAt: new Date().toISOString()
        });
      }
      
      onClose();
      setName('');
      setDescription('');
      setIsPrivate(false);
      setPassword('');
    } catch (err) {
      console.error(err);
      setError('Failed to create chat room.');
    } finally {
      setLoading(false);
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
          <Plus size={22} className="text-indigo-400" />
          Create New Room
        </h2>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm mb-4 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Room Name</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                <Hash size={18} />
              </span>
              <input
                type="text"
                placeholder="tech-talks"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="w-full glass-input pl-10"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500">Lowercase, no spaces. E.g. developer-lounge</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-400">Description (Optional)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 pt-3.5 flex items-start text-slate-500">
                <Info size={18} />
              </span>
              <textarea
                placeholder="Discuss the latest programming frameworks and libraries..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={100}
                className="w-full glass-input pl-10 h-20 resize-none"
              />
            </div>
          </div>

          {/* Toggle Privacy */}
          <div className="pt-2">
            <label className="checkbox-container">
              Make Room Private (Password Protected)
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span className="checkmark"></span>
            </label>
          </div>

          {isPrivate && (
            <div className="flex flex-col gap-1.5 animate-fade-in">
              <label className="text-xs font-semibold text-slate-400">Room Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500">
                  <Lock size={18} />
                </span>
                <input
                  type="password"
                  placeholder="Enter access code"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full glass-input pl-10"
                  required
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/60">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary px-6"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Create Room'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
