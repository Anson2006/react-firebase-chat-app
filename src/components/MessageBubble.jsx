import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Trash2, Smile, Heart, ThumbsUp, Flame, Laugh, AlertCircle } from 'lucide-react';

const EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '😢'];

export default function MessageBubble({ message, roomId, onDeleteMock, onReactMock }) {
  const { currentUser, firebaseActive } = useAuth();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isMe = message.senderId === currentUser?.uid;
  const isSystem = message.isSystem;

  const formatTime = (ts) => {
    if (!ts) return '';
    try {
      const date = ts.seconds ? new Date(ts.seconds * 1000) : new Date(ts);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this message?')) {
      try {
        if (firebaseActive) {
          await deleteDoc(doc(db, `rooms/${roomId}/messages`, message.id));
        } else {
          onDeleteMock(message.id);
        }
      } catch (e) {
        console.error('Error deleting message:', e);
      }
    }
  };

  const handleReact = async (emoji) => {
    setShowEmojiPicker(false);
    
    // Structure of reactions: { "👍": ["uid1", "uid2"], ... }
    const currentReactions = message.reactions || {};
    const emojiUsers = currentReactions[emoji] || [];
    let updatedUsers = [];

    if (emojiUsers.includes(currentUser.uid)) {
      // Remove reaction
      updatedUsers = emojiUsers.filter(uid => uid !== currentUser.uid);
    } else {
      // Add reaction
      updatedUsers = [...emojiUsers, currentUser.uid];
    }

    const updatedReactions = {
      ...currentReactions,
      [emoji]: updatedUsers
    };

    // Clean up empty emoji arrays
    if (updatedUsers.length === 0) {
      delete updatedReactions[emoji];
    }

    try {
      if (firebaseActive) {
        await updateDoc(doc(db, `rooms/${roomId}/messages`, message.id), {
          reactions: updatedReactions
        });
      } else {
        onReactMock(message.id, updatedReactions);
      }
    } catch (e) {
      console.error('Error updating reaction:', e);
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-3 animate-fade-in">
        <div className="px-4 py-1.5 rounded-full bg-slate-900/40 border border-slate-800/40 text-xs text-slate-400 font-medium">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2.5 my-4 group animate-fade-in ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Sender Avatar */}
      <img
        src={message.senderPhoto || `https://api.dicebear.com/7.x/bottts/svg?seed=${message.senderId}`}
        alt={message.senderName}
        className="w-9 h-9 rounded-full object-cover bg-slate-800 border border-slate-700/50"
      />

      {/* Message Info + Bubble */}
      <div className={`flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Name and time */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-xs font-semibold text-slate-300">{message.senderName}</span>
          <span className="text-[10px] text-slate-500">{formatTime(message.createdAt)}</span>
        </div>

        {/* Message bubble core */}
        <div className="relative group/bubble">
          <div
            className={`px-4 py-3 rounded-2xl border leading-relaxed break-words text-[14.5px] ${
              isMe
                ? 'bg-gradient-to-br from-indigo-600 to-purple-600 border-indigo-500/40 text-white rounded-tr-none'
                : 'bg-slate-800/80 border-slate-700/40 text-slate-200 rounded-tl-none'
            }`}
          >
            {message.imageUrl && (
              <div className="mb-2 max-w-full rounded-lg overflow-hidden border border-white/5 bg-slate-950">
                <img
                  src={message.imageUrl}
                  alt="Attachment"
                  className="max-h-60 object-contain w-full"
                  loading="lazy"
                />
              </div>
            )}
            {message.text && <p>{message.text}</p>}
          </div>

          {/* Quick Actions (Reactions & Delete) */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-200 z-10 ${
              isMe ? 'right-full mr-2 flex-row-reverse' : 'left-full ml-2 flex-row'
            }`}
          >
            {/* Reaction Trigger */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 transition-all shadow-lg"
                title="React"
              >
                <Smile size={14} />
              </button>

              {showEmojiPicker && (
                <div
                  className={`absolute bottom-full mb-1.5 flex items-center gap-1 p-1 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-20 ${
                    isMe ? 'right-0' : 'left-0'
                  }`}
                >
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      className="hover:scale-130 transition-transform p-1 text-base leading-none"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Delete Trigger */}
            {isMe && (
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-rose-500 hover:text-rose-400 hover:bg-slate-700 transition-all shadow-lg"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Reaction Badges */}
        {message.reactions && Object.keys(message.reactions).length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(message.reactions).map(([emoji, uids]) => {
              if (!uids || uids.length === 0) return null;
              const hasReacted = uids.includes(currentUser?.uid);
              return (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border transition-all ${
                    hasReacted
                      ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-800/60 border-slate-700/30 text-slate-400 hover:border-slate-600'
                  }`}
                  title={`${uids.length} reaction(s)`}
                >
                  <span>{emoji}</span>
                  <span className="font-semibold">{uids.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
