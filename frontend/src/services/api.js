import axios from 'axios';
import { fetchAuthSession, signOut } from 'aws-amplify/auth';
import { API_BASE_URL } from '../utils/constants';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      //Fails naturally so this can be empty
    }
    return config;
  },
  (err) => Promise.reject(err)
);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.error_code;
    const sessionExpired =
      status === 401 && (code === 'TOKEN_EXPIRED' || code === 'UNAUTHORISED');

    if (sessionExpired && !window.location.pathname.startsWith('/login')) {
      try {
        await signOut();
      } catch (e) {
        console.error(e);
      }
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;