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
   * Mandatory: Role strictly set to 'CITIZEN' on the server
   */
  const register = async (name, email, password) => {
    setAuthError(null);
    setLoading(true);

    try {
      const res = await api.register({ name, email, password });
      if (!res.ok) {
        throw new Error(res.data?.message || 'Registration failed. Please verify your details.');
      }

      if (res.data?.token) {
        const authToken = res.data.token;
        setToken(authToken);
        localStorage.setItem('civicflow_token', authToken);
        if (res.data.user) {
          setUser(res.data.user);
        } else {
          await fetchAndSetUserProfile(authToken);
        }
      }
      return { success: true };
    } catch (err) {
      const errorMsg = err.message || 'Registration failed';
      setAuthError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * User Login with Credentials
   */
  const login = async (email, password) => {
    setAuthError(null);
    setLoading(true);

    try {
      const res = await api.login(email, password);
      if (!res.ok) {
        throw new Error(res.data?.message || 'Email or password is incorrect.');
      }

      const authToken = res.data.token;
      setToken(authToken);
      localStorage.setItem('civicflow_token', authToken);
      if (res.data.user) {
        setUser(res.data.user);
      } else {
        await fetchAndSetUserProfile(authToken);
      }
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Email or password is incorrect.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Dev Login / Quick Role Testing Switcher
   * Maintained exclusively for development environments & test runs
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
      await api.logout().catch(() => {});
      if (isFirebaseConfigured && auth) {
        await firebaseSignOut(auth).catch(() => {});
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
