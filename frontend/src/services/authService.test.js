import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  register,
  login,
  logout,
  getCurrentUser,
  getToken,
  isAuthenticated,
} from './authService';

vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../utils/constants', () => ({
  TOKEN_KEY: 'test_token_key',
}));

import api from './api';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('authService', () => {

  describe('register', () => {
    it('calls the correct endpoint with correct payload', async () => {
      api.post.mockResolvedValueOnce({ data: { id: '123', email: 'test@test.com' } });
      await register('Test User', 'test@test.com', 'Password1!');
      expect(api.post).toHaveBeenCalledWith('/auth/register', {
        full_name: 'Test User',
        email: 'test@test.com',
        password: 'Password1!',
      });
    });

    it('returns response data on success', async () => {
      const mockUser = { id: '123', email: 'test@test.com', full_name: 'Test User' };
      api.post.mockResolvedValueOnce({ data: mockUser });
      const result = await register('Test User', 'test@test.com', 'Password1!');
      expect(result).toEqual(mockUser);
    });

    it('throws when registration fails', async () => {
      api.post.mockRejectedValueOnce(new Error('Email already exists'));
      await expect(register('Test User', 'test@test.com', 'Password1!')).rejects.toThrow();
    });
  });

  describe('login', () => {
    it('calls the correct endpoint with credentials', async () => {
      api.post.mockResolvedValueOnce({ data: { access_token: 'mock-token', token_type: 'bearer' } });
      await login('test@test.com', 'Password1!');
      expect(api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@test.com',
        password: 'Password1!',
      });
    });

    it('stores the token in localStorage on success', async () => {
      api.post.mockResolvedValueOnce({ data: { access_token: 'mock-token', token_type: 'bearer' } });
      await login('test@test.com', 'Password1!');
      expect(localStorage.getItem('test_token_key')).toBe('mock-token');
    });

    it('returns response data', async () => {
      const mockResponse = { access_token: 'mock-token', token_type: 'bearer' };
      api.post.mockResolvedValueOnce({ data: mockResponse });
      const result = await login('test@test.com', 'Password1!');
      expect(result).toEqual(mockResponse);
    });

    it('throws when login fails', async () => {
      api.post.mockRejectedValueOnce(new Error('Invalid credentials'));
      await expect(login('test@test.com', 'wrong')).rejects.toThrow();
    });

    it('does not store token when login fails', async () => {
      api.post.mockRejectedValueOnce(new Error('Invalid credentials'));
      try { await login('test@test.com', 'wrong'); } catch (_e) { /* error */ }
      expect(localStorage.getItem('test_token_key')).toBeNull();
    });
  });

  describe('logout', () => {
    it('removes the token from localStorage', () => {
      localStorage.setItem('test_token_key', 'mock-token');
      logout();
      expect(localStorage.getItem('test_token_key')).toBeNull();
    });

    it('does not throw when no token exists', () => {
      expect(() => logout()).not.toThrow();
    });
  });

  describe('getCurrentUser', () => {
    it('calls the correct endpoint', async () => {
      api.get.mockResolvedValueOnce({ data: { id: '123', email: 'test@test.com' } });
      await getCurrentUser();
      expect(api.get).toHaveBeenCalledWith('/auth/me');
    });

    it('returns user data', async () => {
      const mockUser = { id: '123', email: 'test@test.com', full_name: 'Test User' };
      api.get.mockResolvedValueOnce({ data: mockUser });
      const result = await getCurrentUser();
      expect(result).toEqual(mockUser);
    });

    it('throws when request fails', async () => {
      api.get.mockRejectedValueOnce(new Error('Unauthorised'));
      await expect(getCurrentUser()).rejects.toThrow();
    });
  });

  describe('getToken', () => {
    it('returns null when no token is stored', () => {
      expect(getToken()).toBeNull();
    });

    it('returns the stored token', () => {
      localStorage.setItem('test_token_key', 'mock-token');
      expect(getToken()).toBe('mock-token');
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no token is stored', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('returns true when a token is stored', () => {
      localStorage.setItem('test_token_key', 'mock-token');
      expect(isAuthenticated()).toBe(true);
    });

    it('returns false after logout', () => {
      localStorage.setItem('test_token_key', 'mock-token');
      logout();
      expect(isAuthenticated()).toBe(false);
    });
  });
});