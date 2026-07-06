import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, storage, clearFirebaseConfig } from '../firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  doc, 
  setDoc
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  LogOut, 
  Plus, 
  Hash, 
  Send, 
  Image as ImageIcon, 
  Search, 
  Lock, 
  Unlock, 
  MessageSquare, 
  Menu, 
  X, 
  Database,
  Sparkles,
  Users
} from 'lucide-react';
import RoomModal from '../components/RoomModal';
import ProfileModal from '../components/ProfileModal';
import MessageBubble from '../components/MessageBubble';

export default function Dashboard() {
  const { currentUser, logout, firebaseActive } = useAuth();
  
  // Sidebar state
  const [rooms, setRooms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRoom, setActiveRoom] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Chat window state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSending, setIsSending] = useState(false);

  // Typing state
  const [typers, setTypers] = useState([]);
  const typingTimeoutRef = useRef(null);

  // Modals state
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Password room lock state
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [unlockedRoomIds, setUnlockedRoomIds] = useState([]);
  const [passwordError, setPasswordError] = useState('');

  // Refs
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Mock State (for Demo Mode)
  const [mockRooms, setMockRooms] = useState(() => {
    const saved = localStorage.getItem('mock_rooms');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'welcome',
        name: 'welcome-lobby',
        displayName: 'Welcome Lobby',
        description: 'Welcome to AuraChat! Try out the demo room features here.',
        isPrivate: false,
        creatorName: 'System'
      },
      {
        id: 'tech',
        name: 'tech-lounge',
        displayName: 'Tech Lounge',
        description: 'Talk all things engineering, code, frameworks and design.',
        isPrivate: false,
        creatorName: 'System'
      },
      {
        id: 'secret',
        name: 'classified-lounge',
        displayName: 'Classified Lounge',
        description: 'Access restricted. Demo password is: "aura123"',
        isPrivate: true,
        password: 'aura123',
        creatorName: 'System'
      }
    ];
  });

  const [mockMessages, setMockMessages] = useState(() => {
    const saved = localStorage.getItem('mock_messages');
    if (saved) return JSON.parse(saved);
    return {
      welcome: [
        {
          id: 'm1',
          text: '👋 Welcome to the AuraChat Dashboard!',
          senderId: 'system',
          senderName: 'System',
          senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          isSystem: true
        },
        {
          id: 'm2',
          text: 'This application is currently in Offline Demo Mode. You can add messages, attach images, toggle password-protected rooms, and experience UI workflows locally.',
          senderId: 'aurabot',
          senderName: 'Aura Bot',
          senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=aurabot',
          createdAt: new Date(Date.now() - 1800000).toISOString()
        }
      ],
      tech: [
        {
          id: 't1',
          text: 'Code workspace ready. What are we building today?',
          senderId: 'aurabot',
          senderName: 'Aura Bot',
          senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=aurabot',
          createdAt: new Date(Date.now() - 900000).toISOString()
        }
      ]
    };
  });

  // Save mock data updates
  useEffect(() => {
    if (!firebaseActive) {
      localStorage.setItem('mock_rooms', JSON.stringify(mockRooms));
    }
  }, [mockRooms, firebaseActive]);

  useEffect(() => {
    if (!firebaseActive) {
      localStorage.setItem('mock_messages', JSON.stringify(mockMessages));
    }
  }, [mockMessages, firebaseActive]);

  // Load Rooms list
  useEffect(() => {
    if (!firebaseActive) {
      setRooms(mockRooms);
      return;
    }

    const q = query(collection(db, 'rooms'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomList = [];
      snapshot.forEach((doc) => {
        roomList.push({ id: doc.id, ...doc.data() });
      });
      setRooms(roomList);
    });

    return unsubscribe;
  }, [firebaseActive, mockRooms]);

  // Load Messages for active room
  useEffect(() => {
    if (!activeRoom) return;

    // Check password protection
    if (activeRoom.isPrivate && !unlockedRoomIds.includes(activeRoom.id)) {
      setMessages([]);
      return;
    }

    if (!firebaseActive) {
      setMessages(mockMessages[activeRoom.id] || []);
      return;
    }

    const q = query(
      collection(db, `rooms/${activeRoom.id}/messages`),
      orderBy('createdAt', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = [];
      snapshot.forEach((doc) => {
        msgList.push({ id: doc.id, ...doc.data() });
      });
      setMessages(msgList);
    });

    return unsubscribe;
  }, [activeRoom, firebaseActive, mockMessages, unlockedRoomIds]);

  // Listen to typing indicators in current room
  useEffect(() => {
    if (!activeRoom || !firebaseActive) {
      setTypers([]);
      return;
    }

    const typingRef = collection(db, `rooms/${activeRoom.id}/typing`);
    const unsubscribe = onSnapshot(typingRef, (snapshot) => {
      const typingUsers = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Check if status is typing and user is not current user and data is relatively fresh (last 10 seconds)
        const timeDiff = Date.now() - (data.updatedAt?.toMillis() || Date.now());
        if (doc.id !== currentUser.uid && data.isTyping && timeDiff < 10000) {
          typingUsers.push({ uid: doc.id, displayName: data.displayName });
        }
      });
      setTypers(typingUsers);
    });

    return unsubscribe;
  }, [activeRoom, firebaseActive, currentUser]);

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typers]);

  // Handle room password verification
  const handleUnlockRoom = (e) => {
    e.preventDefault();
    setPasswordError('');
    if (roomPasswordInput === activeRoom.password) {
      setUnlockedRoomIds([...unlockedRoomIds, activeRoom.id]);
      setRoomPasswordInput('');
    } else {
      setPasswordError('Invalid password. Please try again.');
    }
  };

  // Image Attachment Previews
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds the 5MB limit.');
        return;
      }
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeAttachedImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle typing presence triggering
  const handleTypingPresence = (isTyping) => {
    if (!activeRoom || !firebaseActive) return;

    const userTypingRef = doc(db, `rooms/${activeRoom.id}/typing`, currentUser.uid);
    setDoc(userTypingRef, {
      isTyping,
      displayName: currentUser.displayName,
      updatedAt: serverTimestamp()
    }, { merge: true }).catch(err => console.error("Typing update failed:", err));
  };

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);

    // Trigger typing state
    handleTypingPresence(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      handleTypingPresence(false);
    }, 2000);
  };

  // Upload attachment file (Firebase Storage or local base64)
  const uploadAttachment = async () => {
    if (!imageFile) return null;
    
    if (!firebaseActive) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(imageFile);
      });
    }

    const fileRef = ref(storage, `rooms/${activeRoom.id}/${currentUser.uid}_${Date.now()}`);
    const uploadTask = uploadBytesResumable(fileRef, imageFile);

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error(error);
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }
      );
    });
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !imageFile) return;

    setIsSending(true);
    handleTypingPresence(false);

    try {
      const imageUrl = await uploadAttachment();

      const messageObj = {
        text: newMessage.trim(),
        imageUrl: imageUrl || null,
        senderId: currentUser.uid,
        senderName: currentUser.displayName,
        senderPhoto: currentUser.photoURL,
        createdAt: firebaseActive ? serverTimestamp() : new Date().toISOString(),
        reactions: {}
      };

      if (firebaseActive) {
        await addDoc(collection(db, `rooms/${activeRoom.id}/messages`), messageObj);
      } else {
        // Mock Send local update
        const mockMsgId = 'mock_msg_' + Date.now();
        const activeRoomMsgs = mockMessages[activeRoom.id] || [];
        
        const newMockMessages = {
          ...mockMessages,
          [activeRoom.id]: [...activeRoomMsgs, { id: mockMsgId, ...messageObj }]
        };
        
        setMockMessages(newMockMessages);

        // Simulate a smart Bot reply after 1.5 seconds if sending in demo rooms
        if (newMessage.trim()) {
          simulateBotReply(activeRoom.id, newMessage.trim(), newMockMessages);
        }
      }

      setNewMessage('');
      removeAttachedImage();
    } catch (err) {
      console.error('Failed to send message:', err);
      alert('Error sending message. Check console for details.');
    } finally {
      setIsSending(false);
      setUploadProgress(0);
    }
  };

  // Bot response simulator for Offline Demo Mode
  const simulateBotReply = (roomId, userTxt, currentMsgsMap) => {
    // Show typing dots locally
    setTimeout(() => {
      setTypers([{ uid: 'aurabot', displayName: 'Aura Bot' }]);
    }, 600);

    setTimeout(() => {
      setTypers([]);
      
      const responses = [
        `🤖 That sounds fascinating! AuraChat's UI layout matches user themes nicely, doesn't it?`,
        `💡 Real-time Firestore sync behaves exactly like this, updating instantly without page reloads.`,
        `🚀 In active Firebase mode, you can upload media directly into cloud buckets!`,
        `🔒 Password locked rooms are secured on Firestore rules to deny unauthorized reads.`,
        `✨ AuraChat styles run on raw, responsive CSS grids with glassmorphism overlays. Try resizing your viewport!`
      ];
      
      const botMessageObj = {
        id: 'bot_msg_' + Date.now(),
        text: responses[Math.floor(Math.random() * responses.length)],
        senderId: 'aurabot',
        senderName: 'Aura Bot',
        senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=aurabot',
        createdAt: new Date().toISOString(),
        reactions: {}
      };

      const finalMsgsMap = {
        ...currentMsgsMap,
        [roomId]: [...(currentMsgsMap[roomId] || []), botMessageObj]
      };
      setMockMessages(finalMsgsMap);
    }, 2000);
  };

  // Mock message reactions handler
  const handleReactMock = (msgId, newReactions) => {
    const updatedRoomMsgs = (mockMessages[activeRoom.id] || []).map(msg => {
      if (msg.id === msgId) {
        return { ...msg, reactions: newReactions };
      }
      return msg;
    });

    setMockMessages({
      ...mockMessages,
      [activeRoom.id]: updatedRoomMsgs
    });
  };

  // Mock message delete handler
  const handleDeleteMock = (msgId) => {
    const updatedRoomMsgs = (mockMessages[activeRoom.id] || []).filter(msg => msg.id !== msgId);
    setMockMessages({
      ...mockMessages,
      [activeRoom.id]: updatedRoomMsgs
    });
  };

  // Handle Mock Room Creation
  const handleRoomCreatedMock = (newRoom) => {
    setMockRooms([...mockRooms, newRoom]);
    // Initialize empty message thread
    setMockMessages({
      ...mockMessages,
      [newRoom.id]: [
        {
          id: 'welcome_' + newRoom.id,
          text: `👋 welcome to the #${newRoom.name} room! Created by ${currentUser.displayName}`,
          senderId: 'system',
          senderName: 'System',
          senderPhoto: 'https://api.dicebear.com/7.x/bottts/svg?seed=system',
          createdAt: new Date().toISOString(),
          isSystem: true
        }
      ]
    });
    setActiveRoom(newRoom);
  };

  // Filter rooms based on query
  const filteredRooms = rooms.filter(room => 
    room.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (room.description && room.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      
      {/* Sidebar - responsive sliding panel */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-80 bg-slate-900 border-r border-slate-800/80 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-glow text-white">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight">AuraChat</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${firebaseActive ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                <span className="text-[10px] text-slate-400 font-medium">
                  {firebaseActive ? 'Firebase cloud' : 'Local demo'}
                </span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Quick Profile Info */}
        <div className="p-3 bg-slate-950/40 border-b border-slate-800/40 flex items-center justify-between">
          <div 
            onClick={() => setIsProfileModalOpen(true)}
            className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 p-1.5 rounded-xl transition-colors flex-1 min-w-0 mr-2"
            title="Edit Profile"
          >
            <img 
              src={currentUser?.photoURL} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full border border-slate-700 bg-slate-900 object-cover"
            />
            <div className="truncate flex flex-col">
              <span className="text-xs font-semibold text-slate-200 truncate">{currentUser?.displayName}</span>
              <span className="text-[9px] text-slate-500 truncate">{currentUser?.email}</span>
            </div>
          </div>
          
          <button 
            onClick={logout}
            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            title="Log Out"
          >
            <LogOut size={16} />
          </button>
        </div>

        {/* Rooms Search & Add Area */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
              <Search size={14} />
            </span>
            <input 
              type="text" 
              placeholder="Search chat rooms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass-input py-2 pl-9 pr-3 text-xs"
            />
          </div>

          <button 
            onClick={() => setIsRoomModalOpen(true)}
            className="w-full btn-secondary py-2 flex items-center justify-center gap-1.5 text-xs font-semibold hover:border-indigo-500 hover:text-indigo-300"
          >
            <Plus size={14} />
            New Chat Room
          </button>
        </div>

        {/* Rooms Scroll List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 px-3 mb-2 flex items-center gap-1">
            <MessageSquare size={10} />
            Chat Rooms ({filteredRooms.length})
          </div>

          <div className="space-y-0.5">
            {filteredRooms.map((room) => {
              const isSelected = activeRoom?.id === room.id;
              const isLocked = room.isPrivate && !unlockedRoomIds.includes(room.id);
              
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setActiveRoom(room);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                    isSelected 
                      ? 'bg-gradient-to-r from-indigo-500/10 to-indigo-500/0 border-l-2 border-indigo-500 text-indigo-200' 
                      : 'hover:bg-slate-800/40 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={isSelected ? 'text-indigo-400' : 'text-slate-500'}>
                      <Hash size={15} />
                    </span>
                    <div className="truncate flex flex-col">
                      <span className="text-xs font-medium truncate">{room.displayName || room.name}</span>
                      {room.description && (
                        <span className="text-[10px] text-slate-500 truncate leading-normal">
                          {room.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {room.isPrivate && (
                    <span className="text-slate-500">
                      {isLocked ? <Lock size={12} /> : <Unlock size={12} className="text-emerald-400" />}
                    </span>
                  )}
                </button>
              );
            })}
            
            {filteredRooms.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500">
                No active rooms found
              </div>
            )}
          </div>
        </div>

        {/* Database Clear Button (in Demo Mode only) */}
        {!firebaseActive && (
          <div className="p-3 border-t border-slate-800/50 bg-slate-950/20">
            <button 
              onClick={() => {
                if (confirm('Clear local database data and restore original system defaults?')) {
                  localStorage.removeItem('mock_rooms');
                  localStorage.removeItem('mock_messages');
                  window.location.reload();
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-red-500/5 border border-red-500/15 text-[10px] text-red-400 hover:bg-red-500/10 transition-colors font-medium"
            >
              Reset Demo Database
            </button>
          </div>
        )}

        {/* Database Connection widget for offline users */}
        {firebaseActive && (
          <div className="p-3 border-t border-slate-800/50 bg-slate-950/20 text-center">
            <button 
              onClick={clearFirebaseConfig}
              className="text-[10px] text-slate-500 hover:text-slate-300 underline flex items-center justify-center gap-1 w-full"
            >
              <Database size={10} />
              Disconnect Firebase Server
            </button>
          </div>
        )}
      </aside>

      {/* Main chat window container */}
      <main className="flex-1 flex flex-col h-full bg-slate-950 relative min-w-0">
        
        {/* Top Navbar */}
        <header className="h-14 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
            >
              <Menu size={20} />
            </button>

            {activeRoom ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <Hash size={16} className="text-indigo-400" />
                  <span className="font-semibold text-sm text-white">{activeRoom.displayName || activeRoom.name}</span>
                  {activeRoom.isPrivate && <Lock size={12} className="text-slate-500" />}
                </div>
                {activeRoom.description && (
                  <span className="text-[10px] text-slate-400 hidden sm:inline truncate max-w-sm">
                    {activeRoom.description}
                  </span>
                )}
              </div>
            ) : (
              <span className="font-semibold text-sm">Dashboard</span>
            )}
          </div>

          {activeRoom && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/50 px-2.5 py-1 rounded-full border border-slate-700/20">
              <Users size={12} className="text-indigo-400" />
              <span>Created by {activeRoom.creatorName}</span>
            </div>
          )}
        </header>

        {/* Chat Body - Message streams or password forms or welcome guide */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0 bg-slate-950/40 relative">
          
          {/* 1. Welcoming Screen (if no room selected) */}
          {!activeRoom && (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6 shadow-glow">
                <MessageSquare size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome, {currentUser?.displayName}!</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                Create a new chat room or choose an existing room from the sidebar to start exchanging real-time messages, sharing files, and using custom reactions.
              </p>
              <button 
                onClick={() => setIsRoomModalOpen(true)}
                className="btn-primary"
              >
                <Plus size={18} />
                Create Room
              </button>
            </div>
          )}

          {/* 2. Room Locked Gate */}
          {activeRoom && activeRoom.isPrivate && !unlockedRoomIds.includes(activeRoom.id) && (
            <div className="h-full flex flex-col items-center justify-center p-6 max-w-sm mx-auto">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-5">
                <Lock size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Private Room</h3>
              <p className="text-slate-400 text-xs text-center leading-normal mb-6">
                Enter this chat room's credentials to authorize access.
              </p>
              <form onSubmit={handleUnlockRoom} className="w-full space-y-3">
                <input 
                  type="password" 
                  placeholder="Enter Room Password" 
                  value={roomPasswordInput}
                  onChange={(e) => setRoomPasswordInput(e.target.value)}
                  className="w-full glass-input text-center"
                  required
                />
                {passwordError && (
                  <p className="text-[11px] text-rose-500 text-center">{passwordError}</p>
                )}
                <button type="submit" className="w-full btn-primary py-2 text-xs">
                  Unlock Channel
                </button>
              </form>
            </div>
          )}

          {/* 3. Messages Stream */}
          {activeRoom && (!activeRoom.isPrivate || unlockedRoomIds.includes(activeRoom.id)) && (
            <>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  roomId={activeRoom.id}
                  onDeleteMock={handleDeleteMock}
                  onReactMock={handleReactMock}
                />
              ))}

              {messages.length === 0 && (
                <div className="text-center py-12 text-xs text-slate-500">
                  This room has no message records yet. Write the first message below!
                </div>
              )}

              {/* Real-time Typing Bubbles */}
              {typers.length > 0 && (
                <div className="flex items-center gap-2 my-3 pl-1">
                  <div className="typing-dots">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                  <span className="text-[10px] text-slate-500 italic">
                    {typers.map(t => t.displayName).join(', ')} {typers.length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Chat Input Area */}
        {activeRoom && (!activeRoom.isPrivate || unlockedRoomIds.includes(activeRoom.id)) && (
          <div className="p-4 border-t border-slate-800/80 bg-slate-900/40">
            {/* Attachment preview indicator */}
            {imagePreview && (
              <div className="mb-3 p-2 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between max-w-sm animate-fade-in">
                <div className="flex items-center gap-2">
                  <img src={imagePreview} alt="Attached Preview" className="w-12 h-12 object-cover rounded-lg border border-slate-800" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[180px]">{imageFile?.name}</span>
                    <span className="text-[9px] text-slate-500">{(imageFile?.size / 1024).toFixed(0)} KB</span>
                  </div>
                </div>
                <button 
                  onClick={removeAttachedImage}
                  className="p-1 rounded-full bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Input Form container */}
            <form onSubmit={handleSendMessage} className="flex items-end gap-2.5">
              
              {/* File Attachment Input Trigger */}
              <div className="relative">
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
                  title="Attach Photo"
                >
                  <ImageIcon size={18} />
                </button>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={handleImageSelect}
                  ref={fileInputRef}
                  className="hidden"
                />
              </div>

              {/* Core Text Input */}
              <div className="flex-1 relative">
                <input 
                  type="text"
                  placeholder={`Send message to #${activeRoom.name}...`}
                  value={newMessage}
                  onChange={handleInputChange}
                  className="w-full glass-input py-3 pr-4"
                  maxLength={1000}
                />
              </div>

              {/* Progress bar overlay for attachments */}
              {isSending && uploadProgress > 0 && (
                <div className="absolute inset-x-0 top-0 h-1 bg-slate-850">
                  <div className="bg-indigo-500 h-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              )}

              {/* Send Button */}
              <button 
                type="submit" 
                disabled={isSending || (!newMessage.trim() && !imageFile)}
                className="btn-primary p-3"
              >
                {isSending ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                ) : (
                  <Send size={18} />
                )}
              </button>
            </form>
          </div>
        )}

      </main>

      {/* Room Creation Modal */}
      <RoomModal 
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        onRoomCreatedMock={handleRoomCreatedMock}
      />

      {/* Profile Modification Modal */}
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

    </div>
  );
}
