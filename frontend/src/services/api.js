import { signOut } from 'aws-amplify/auth';
import axios from 'axios';

import { API_BASE_URL } from '../utils/constants';

import { clearGuestSession, getAccessToken, readGuestSession } from './guestSession';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  async (config) => {
    const token = await getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err),
);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.error_code;
    const sessionExpired =
      status === 401 && (code === 'TOKEN_EXPIRED' || code === 'UNAUTHORISED');

    if (sessionExpired && !window.location.pathname.startsWith('/login')) {
      if (readGuestSession()) {
        clearGuestSession();
        window.location.href = '/login?guest=ended';
        return Promise.reject(err);
      }
      try {
        await signOut();
      } catch (e) {
        console.error(e);
      }
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
