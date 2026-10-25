import * as auth from 'aws-amplify/auth';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import api from './api';
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
  startGuestSession,
  getGuestModeStatus,
  endGuestSession,
} from './authService';
import { readGuestSession } from './guestSession';

vi.mock('aws-amplify/auth');
vi.mock('./api', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('delegates pass-through actions to amplify SDK', () => {
    confirmRegistration('jane@example.com', '123456');
    expect(auth.confirmSignUp).toHaveBeenCalledWith({
      username: 'jane@example.com',
      confirmationCode: '123456',
    });

    login('jane@example.com', 'pw123456');
    expect(auth.signIn).toHaveBeenCalledWith({
      username: 'jane@example.com',
      password: 'pw123456',
    });

    respondToMFA('654321');
    expect(auth.confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '654321' });

    initTOTPSetup();
    expect(auth.setUpTOTP).toHaveBeenCalled();

    logout();
    expect(auth.signOut).toHaveBeenCalled();
  });

  describe('register', () => {
    it('formats sign-up payload and returns user info', async () => {
      vi.mocked(auth.signUp).mockResolvedValueOnce(/** @type {any} */({ userId: 'abc-123' }));

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
      await expect(register('Jane', 'jane@example.com', 'pw')).rejects.toThrow(
        'email already registered',
      );
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
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce(/** @type {any} */({
        tokens: { accessToken: { toString: () => 'the-access-token' } },
      }));
      await expect(getToken()).resolves.toBe('the-access-token');
    }); 

    it('returns null on missing session, missing token, or errors', async () => {
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce({});
      await expect(getToken()).resolves.toBeNull();

      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce(/** @type {any} */({ tokens: null }));
      await expect(getToken()).resolves.toBeNull();

      vi.mocked(auth.fetchAuthSession).mockRejectedValueOnce(new Error('network error'));
      await expect(getToken()).resolves.toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true only when valid access token exists', async () => {
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce(/** @type {any} */({ tokens: { accessToken: 'x' } }));
      await expect(isAuthenticated()).resolves.toBe(true);

      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce(/** @type {any} */({ tokens: {} }));
      await expect(isAuthenticated()).resolves.toBe(false);

      vi.mocked(auth.fetchAuthSession).mockRejectedValueOnce(new Error('network error'));
      await expect(isAuthenticated()).resolves.toBe(false);
    });
  });

  describe('getCurrentUserProfile', () => {
    it('constructs user profile from session tokens with fallbacks', async () => {
      vi.mocked(auth.getCurrentUser).mockResolvedValue(/** @type {any} */({ userId: 'user-1' }));
      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce(/** @type {any} */({
        tokens: { idToken: { payload: { email: 'jane@example.com', name: 'Jane Doe' } } },
      }));

      await expect(getCurrentUserProfile()).resolves.toEqual({
        sub: 'user-1',
        email: 'jane@example.com',
        full_name: 'Jane Doe',
      });

      vi.mocked(auth.fetchAuthSession).mockResolvedValueOnce(/** @type {any} */({ tokens: {} }));
      await expect(getCurrentUserProfile()).resolves.toEqual({
        sub: 'user-1',
        email: '',
        full_name: '',
      });
    });
  });
});

describe('guest session calls', () => {
  const session = {
    access_token: 'guest-token',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: { id: 'guest-1', full_name: 'Guest', is_guest: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('keeps the session the server hands back', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: session });

    expect(await startGuestSession()).toEqual(session);
    expect(api.post).toHaveBeenCalledWith('/auth/guest');
    expect(readGuestSession()).toEqual(session);
  });

  it('reads whether guest mode is on, and treats any failure as off', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { enabled: true } });
    expect(await getGuestModeStatus()).toBe(true);

    vi.mocked(api.get).mockResolvedValueOnce({ data: { enabled: false } });
    expect(await getGuestModeStatus()).toBe(false);

    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'));
    expect(await getGuestModeStatus()).toBe(false);
  });

  it('clears the session even when the server cannot be told', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: session });
    await startGuestSession();
    vi.mocked(api.delete).mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await endGuestSession();

    expect(api.delete).toHaveBeenCalledWith('/auth/guest');
    expect(readGuestSession()).toBeNull();
  });
});
