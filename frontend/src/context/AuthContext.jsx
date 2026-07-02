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
      if (typeof window !== 'undefined' && window.__E2E_AUTH_BYPASS__) {
        setUser(window.__E2E_AUTH_BYPASS__);
        setLoading(false);
        return;
      }
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

  const login = async (email, password) => {
    try {
      const { nextStep } = await loginService(email, password);

      if (nextStep?.signInStep === 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP') {
        setMfaState({ type: 'SETUP', email });
        return { challenge: 'MFA_SETUP', totpSetupDetails: nextStep.totpSetupDetails };
      }

      if (nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setMfaState({ type: 'VERIFY', email });
        return { challenge: 'SOFTWARE_TOKEN_MFA' };
      }

      if (nextStep?.signInStep === 'DONE') {
        setUser(await getCurrentUserProfile());
        setMfaState(null);
        return { challenge: null };
      }
    } catch (err) {
      throw new Error(err.message || 'Login failed');
    }
  };

  const submitMFACode = async (totpCode) => {
    try {
      const result = await respondToMFA(totpCode);
      if (result.isSignedIn || result.nextStep?.signInStep === 'DONE') {
        setUser(await getCurrentUserProfile());
        setMfaState(null);
      }
    } catch (err) {
      throw new Error(err.message || 'Invalid MFA code');
    }
  };

  const logout = async () => {
    try {
      await logoutService();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setMfaState(null);
      setError(null);
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
        login,
        submitMFACode,
        activateTOTP: submitMFACode, //This is aliased to prevent breaking downstream UI
        logout,
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