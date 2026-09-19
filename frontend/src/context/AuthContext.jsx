import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  auth,
  isFirebaseConfigured,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  firebaseSignOut,
  onAuthStateChanged,
} from '../services/firebase';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // application user: { id, authUid, name, email, role }
  const [token, setToken] = useState(() => localStorage.getItem('civicflow_token') || null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Restore authenticated session on initial mount
  useEffect(() => {
    let unsubscribe = () => {};

    if (isFirebaseConfigured && auth) {
      // Listen to live Firebase auth state changes
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const idToken = await firebaseUser.getIdToken();
            setToken(idToken);
            localStorage.setItem('civicflow_token', idToken);
            await fetchAndSetUserProfile(idToken);
          } catch (err) {
            console.error('[AuthContext] Error fetching user profile:', err);
            handleLogout();
          }
        } else {
          setUser(null);
          setToken(null);
          localStorage.removeItem('civicflow_token');
          setLoading(false);
        }
      });
    } else {
      // Local / Dev session persistence from localStorage
      const savedToken = localStorage.getItem('civicflow_token');
      if (savedToken) {
        fetchAndSetUserProfile(savedToken).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }

    return () => unsubscribe();
  }, []);

  // Fetch current user from server-side /api/users/me
  const fetchAndSetUserProfile = async (authToken) => {
    try {
      const res = await api.getCurrentUser(authToken);
      if (res.ok && res.data) {
        setUser(res.data);
        setAuthError(null);
      } else {
        console.warn('[AuthContext] Session invalid or profile not found:', res.data);
        handleLogout();
      }
    } catch (err) {
      console.error('[AuthContext] Profile fetch error:', err);
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  /**
   * User Registration
   * Mandatory: Role strictly set to 'CITIZEN'
   */
  const register = async (name, email, password) => {
    setAuthError(null);
    setLoading(true);

    try {
      let authUid;
      let authToken;

      if (isFirebaseConfigured && auth) {
        // 1. Create user in Firebase Authentication
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        authUid = cred.user.uid;
        authToken = await cred.user.getIdToken();
      } else {
        // Dev fallback provider
        authUid = `auth-usr-${Date.now().toString(36)}`;
        // We sync first, then get dev token
      }

      // 2. Synchronize application user profile in PostgreSQL backend
      // SECURITY MANDATE: Client sends name & email; backend forces role = 'CITIZEN'
      const syncRes = await api.syncRegister({
        authUid,
        name,
        email,
      });

      if (!syncRes.ok) {
        throw new Error(syncRes.data?.message || 'Failed to create application user profile.');
      }

      // If in dev fallback mode, get dev token
      if (!authToken) {
        const devLoginRes = await api.devLogin(email);
        if (devLoginRes.ok && devLoginRes.data.token) {
          authToken = devLoginRes.data.token;
        }
      }

      setToken(authToken);
      localStorage.setItem('civicflow_token', authToken);
      await fetchAndSetUserProfile(authToken);
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Registration failed';
      setAuthError(errorMsg);
      setLoading(false);
      return { success: false, error: errorMsg };
    }
  };

  /**
   * User Login
   */
  const login = async (email, password) => {
    setAuthError(null);
    setLoading(true);

    try {
      let authToken;

      if (isFirebaseConfigured && auth) {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        authToken = await cred.user.getIdToken();
      } else {
        // Dev mode login
        const devRes = await api.devLogin(email);
        if (!devRes.ok) {
          throw new Error(devRes.data?.message || 'Invalid credentials or user not registered');
        }
        authToken = devRes.data.token;
      }

      setToken(authToken);
      localStorage.setItem('civicflow_token', authToken);
      await fetchAndSetUserProfile(authToken);
      return { success: true };
    } catch (err) {
      let msg = err.message || 'Login failed';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        msg = 'Invalid email or password.';
      }
      setAuthError(msg);
      setLoading(false);
      return { success: false, error: msg };
    }
  };

  /**
   * Dev Login / Quick Role Testing Switcher
   * Useful for hackathon evaluation to test CITIZEN, STAFF, ADMIN without manual promotion
   */
  const switchDevRole = async (targetEmail) => {
    setLoading(true);
    try {
      const res = await api.devLogin(targetEmail);
      if (res.ok && res.data.token) {
        setToken(res.data.token);
        localStorage.setItem('civicflow_token', res.data.token);
        setUser(res.data.user);
        setAuthError(null);
      }
    } catch (err) {
      console.error('[AuthContext] Dev switch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * User Logout
   */
  const logout = async () => {
    try {
      if (isFirebaseConfigured && auth) {
        await firebaseSignOut(auth);
      }
    } catch (err) {
      console.warn('[AuthContext] Firebase signOut warning:', err.message);
    } finally {
      handleLogout();
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('civicflow_token');
    setLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        token,
        isAuthenticated: !!user,
        loading,
        authError,
        register,
        login,
        logout,
        switchDevRole,
        refreshProfile: () => (token ? fetchAndSetUserProfile(token) : Promise.resolve()),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
