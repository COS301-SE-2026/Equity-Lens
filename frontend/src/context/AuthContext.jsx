import { createContext, useContext, useState, useEffect } from 'react';
import {
  register as registerService,
  login as loginService,
  logout as logoutService,
  getCurrentUserProfile,
  isAuthenticated,
  confirmRegistration,
  respondToMFA,
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mfaState, setMfaState] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (await isAuthenticated()) {
          setUser(await getCurrentUserProfile());
        }
      } catch (err) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const register = async (fullName, email, password) => {
    try {
      await registerService(fullName, email, password);
    } catch (err) {
      throw new Error(err.message || 'Registration failed');
    }
  };

  const confirmEmail = async (email, code) => {
    try {
      await confirmRegistration(email, code);
    } catch (err) {
      throw new Error(err.message || 'Confirmation failed');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        mfaState,
        register,
        confirmEmail,
        submitMFACode,
        activateTOTP: submitMFACode, //This is aliased to prevent breaking downstream UI
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used in AuthProvider');
  return context;
};