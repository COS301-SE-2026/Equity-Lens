import api from './api';
import { TOKEN_KEY } from '../utils/constants';

export const register = async (fullName, email, password) => {
  const response = await api.post('/api/auth/register', {
    full_name: fullName,
    email,
    password,
  });
  return response.data;
};

export const login = async (email, password) => {
  const response = await api.post('/api/auth/login', { email, password });
  const { access_token } = response.data;
  localStorage.setItem(TOKEN_KEY, access_token);
  return response.data;
};

export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
};

export const getCurrentUser = async () => {
  const response = await api.get('/api/auth/me');
  return response.data;
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const isAuthenticated = () => !!getToken();