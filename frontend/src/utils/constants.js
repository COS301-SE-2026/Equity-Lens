export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  PORTFOLIO: '/portfolio',
  ANALYTICS: '/analytics',
  NEWS: '/news',
  AI_CHAT: '/ai',
  CONFIRM_EMAIL: '/confirm-email',
};

export const PASSWORD_MIN_LENGTH = 8;
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const TOKEN_KEY = 'equitylens_token';
export const THEME_KEY = 'equitylens_theme';
export const API_BASE_URL_NEWS = "http://localhost:8000";