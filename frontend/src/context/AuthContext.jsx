import { createContext, useContext, useState, useEffect } from 'react';
import { register as registerService, login as loginService, logout as logoutService, getCurrentUser, isAuthenticated,
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      if (isAuthenticated()) {
        try {
          const userData = await getCurrentUser();
          setUser(userData);
        } catch {
          logoutService();
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const register = async (fullName, email, password) => {
    setError(null);
    setLoading(true);
    try {
      await registerService(fullName, email, password);
    } catch (err) {
      const message = err.response?.data?.detail || 'Registration failed. Please try again.';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const data = await loginService(email, password);
      const userData = await getCurrentUser();
      setUser(userData);
      return data;
    } catch (err) {
      const message = err.response?.data?.detail || 'Login failed. Please try again.';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    logoutService();
    setUser(null);
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        register,
        login,
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
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
};