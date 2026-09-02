import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as auth from 'aws-amplify/auth';
import {
  register,
  confirmRegistration,
  login,
  respondToMFA,
  initTOTPSetup,
  logout,
  confirmTOTPSetup,
  getToken,
  isAuthenticated,
  getCurrentUserProfile,
} from './authService';

vi.mock('aws-amplify/auth');

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('delegates pass-through actions to amplify SDK', () => {
    confirmRegistration('jane@example.com', '123456');
    expect(auth.confirmSignUp).toHaveBeenCalledWith({ username: 'jane@example.com', confirmationCode: '123456' });

    login('jane@example.com', 'pw123456');
    expect(auth.signIn).toHaveBeenCalledWith({ username: 'jane@example.com', password: 'pw123456' });

    respondToMFA('654321');
    expect(auth.confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '654321' });

    initTOTPSetup();
    expect(auth.setUpTOTP).toHaveBeenCalled();

    logout();
    expect(auth.signOut).toHaveBeenCalled();
  });

  describe('register', () => {
    it('formats sign-up payload and returns user info', async () => {
      vi.mocked(auth.signUp).mockResolvedValueOnce({ userId: 'abc-123' });

      const result = await register('Jane Doe', 'jane@example.com', 'pw123456');

      expect(auth.signUp).toHaveBeenCalledWith({
        username: 'jane@example.com',
        password: 'pw123456',
        options: { userAttributes: { email: 'jane@example.com', name: 'Jane Doe' } },
      });
      expect(result).toEqual({ userId: 'abc-123', email: 'jane@example.com' });
    });

    it('propagates errors on failure', async () => {
      vi.mocked(auth.signUp).mockRejectedValueOnce(new Error('email already registered'));
      await expect(register('Jane', 'jane@example.com', 'pw')).rejects.toThrow('email already registered');
    });
  });

  describe('confirmTOTPSetup', () => {
    it('verifies code and sets MFA preference to preferred', async () => {
      await confirmTOTPSetup('999999');

      expect(auth.verifyTOTPSetup).toHaveBeenCalledWith({ code: '999999' });
      expect(auth.updateMFAPreference).toHaveBeenCalledWith({ totp: 'PREFERRED' });
    });

    it('aborts preference update if code verification fails', async () => {
      vi.mocked(auth.verifyTOTPSetup).mockRejectedValueOnce(new Error('invalid mfa code'));

      await expect(confirmTOTPSetup('000000')).rejects.toThrow('invalid mfa code');
      expect(auth.updateMFAPreference).not.toHaveBeenCalled();
    });
  });

  describe('getToken', () => {
    it('returns access token string when session is valid', async () => {
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({
        tokens: { accessToken: { toString: () => 'the-access-token' } },
      });
      await expect(getToken()).resolves.toBe('the-access-token');
    });

    it('returns null on missing session, missing token, or errors', async () => {
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({});
      await expect(getToken()).resolves.toBeNull();

      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({ tokens: null });
      await expect(getToken()).resolves.toBeNull();

      vi.mocked(auth.fetchAuthSession).mockRejectedValueOnce(new Error('network error'));
      await expect(getToken()).resolves.toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true only when valid access token exists', async () => {
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({ tokens: { accessToken: 'x' } });
      await expect(isAuthenticated()).resolves.toBe(true);

      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({ tokens: {} });
      await expect(isAuthenticated()).resolves.toBe(false);

      vi.mocked(auth.fetchAuthSession).mockRejectedValueOnce(new Error('network error'));
      await expect(isAuthenticated()).resolves.toBe(false);
    });
  });

  describe('getCurrentUserProfile', () => {
    it('constructs user profile from session tokens with fallbacks', async () => {
      vi.mocked(auth.getCurrentUser).mockResolvedValue({ userId: 'user-1' });
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({
        tokens: { idToken: { payload: { email: 'jane@example.com', name: 'Jane Doe' } } },
      });

      await expect(getCurrentUserProfile()).resolves.toEqual({
        sub: 'user-1',
        email: 'jane@example.com',
        full_name: 'Jane Doe',
      });

      
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({ tokens: {} });
      await expect(getCurrentUserProfile()).resolves.toEqual({
        sub: 'user-1',
        email: '',
        full_name: '',
      });
    });
  });
});