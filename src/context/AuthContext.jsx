import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut as fbSignOut, 
  signInWithPopup, 
  updateProfile,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured, db } from '../firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [firebaseActive, setFirebaseActive] = useState(isFirebaseConfigured);

  // Fallback / Mock auth states if firebase is not active
  useEffect(() => {
    if (!firebaseActive) {
      const savedMockUser = localStorage.getItem('mock_chat_user');
      if (savedMockUser) {
        setCurrentUser(JSON.parse(savedMockUser));
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Retrieve custom data if any, like custom avatar if it's set in firestore
        let userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`
        };

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            userData = { ...userData, ...userDoc.data() };
          } else {
            // Save initial user record in firestore
            await setDoc(userDocRef, {
              uid: user.uid,
              displayName: userData.displayName,
              photoURL: userData.photoURL,
              email: userData.email,
              createdAt: new Date().toISOString()
            });
          }
        } catch (e) {
          console.warn("Firestore user fetch skipped or failed:", e);
        }
        
        setCurrentUser(userData);
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [firebaseActive]);

  // Auth operations
  const signup = async (email, password, username) => {
    if (!firebaseActive) {
      // Mock signup
      const mockUid = 'mock_uid_' + Math.random().toString(36).substring(2, 9);
      const newUser = {
        uid: mockUid,
        email,
        displayName: username || email.split('@')[0],
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUid}`
      };
      localStorage.setItem('mock_chat_user', JSON.stringify(newUser));
      setCurrentUser(newUser);
      return newUser;
    }

    const result = await createUserWithEmailAndPassword(auth, email, password);
    const photoURL = `https://api.dicebear.com/7.x/bottts/svg?seed=${result.user.uid}`;
    
    await updateProfile(result.user, {
      displayName: username,
      photoURL
    });

    // Write to firestore
    try {
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        displayName: username,
        photoURL,
        email,
        createdAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Firestore user creation failed:", e);
    }

    return result.user;
  };

  const login = async (email, password) => {
    if (!firebaseActive) {
      // Mock login
      const mockUid = 'mock_uid_12345';
      const mockUser = {
        uid: mockUid,
        email,
        displayName: email.split('@')[0],
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${mockUid}`
      };
      localStorage.setItem('mock_chat_user', JSON.stringify(mockUser));
      setCurrentUser(mockUser);
      return mockUser;
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    if (!firebaseActive) {
      localStorage.removeItem('mock_chat_user');
      setCurrentUser(null);
      return;
    }
    return fbSignOut(auth);
  };

  const loginWithGoogle = async () => {
    if (!firebaseActive) {
      // Mock Google Login
      const mockUid = 'mock_google_' + Math.random().toString(36).substring(2, 9);
      const mockUser = {
        uid: mockUid,
        email: 'googleuser@gmail.com',
        displayName: 'Google User Demo',
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${mockUid}`
      };
      localStorage.setItem('mock_chat_user', JSON.stringify(mockUser));
      setCurrentUser(mockUser);
      return mockUser;
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  };

  const updateUserProfile = async (displayName, photoURL) => {
    if (!currentUser) return;

    if (!firebaseActive) {
      const updated = { ...currentUser, displayName, photoURL };
      localStorage.setItem('mock_chat_user', JSON.stringify(updated));
      setCurrentUser(updated);
      return;
    }

    // Update Firebase Auth Profile
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName, photoURL });
      
      // Update Firestore user record
      try {
        await setDoc(doc(db, 'users', currentUser.uid), {
          displayName,
          photoURL
        }, { merge: true });
      } catch (e) {
        console.error("Firestore user update failed:", e);
      }

      setCurrentUser(prev => ({
        ...prev,
        displayName,
        photoURL
      }));
    }
  };

  const value = {
    currentUser,
    firebaseActive,
    setFirebaseActive,
    signup,
    login,
    logout,
    loginWithGoogle,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
