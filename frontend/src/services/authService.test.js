import { confirmSignIn, confirmSignUp, fetchAuthSession, getCurrentUser, setUpTOTP, signIn, signOut, signUp, updateMFAPreference, verifyTOTPSetup } from "aws-amplify/auth";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock('aws-amplify/auth', () => ({
    signUp: vi.fn(),
    confirmSignUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    getCurrentUser: vi.fn(),
    fetchAuthSession: vi.fn(),
    confirmSignIn: vi.fn(),
    setUpTOTP: vi.fn(),
    verifyTOTPSetup: vi.fn(),
    updateMFAPreference: vi.fn(),
}));

import { confirmRegistration, register, login, respondToMFA, initTOTPSetup, logout, confirmTOTPSetup, getToken, isAuthenticated, getCurrentUserProfile } from "./authService";

beforeEach(() => {
    vi.clearAllMocks();
});

describe('register', () => {
    it('calls signup with correct fields and returns response', async () => {
        signUp.mockResolvedValue({ userId: 'user-123' });
        const result = await register('John Pork', 'john@example.com', 'test123');
        expect(signUp).toHaveBeenCalledWith({
            username: 'john@example.com',
            password: 'test123',
            options: { userAttributes: { email: 'john@example.com', name: 'John Pork' } },
        });
        expect(result).toEqual({ userId: 'user-123', email: 'john@example.com'});
    });
});

describe('confirmRegister', () =>{
    it('calls confirmSignUp with username and the confirmationCode', () => {
        confirmRegistration('john@example.com', '123456');
        expect(confirmSignUp).toHaveBeenCalledWith({ username: 'john@example.com', confirmationCode: '123456'});
    });
});

describe('login', () => {
    it('calls signIn with a username and password', () => {
        login('john@example.com', 'test123');
        expect(signIn).toHaveBeenCalledWith({ username: 'john@example.com', password: 'test123'});
    });
});

describe('respondToMFA', () => {
    it('calls confirmSignIn with challengeResponse', () => {
        respondToMFA('654321');
        expect(confirmSignIn).toHaveBeenCalledWith({ challengeResponse: '654321' });
    });
});

describe('initTOTPSetup', () => {
    it('calls setUpTOTP', () => {
        initTOTPSetup();
        expect(setUpTOTP).toHaveBeenCalled();
    });
});

describe('logout', () => {
    it('calls signOut', () => {
        logout();
        expect(signOut).toHaveBeenCalled();
    });
});

describe('confirmTOTPSetup', () => {
    it('verifies TOTP code then sets MFA preference', async () => {
        await confirmTOTPSetup('111222');
        expect(verifyTOTPSetup).toHaveBeenCalledWith({ code: '111222' });
        expect(updateMFAPreference).toHaveBeenCalledWith({ totp: 'PREFERRED' });
    });
});

describe('getToken', () => {
    it('returns the access token string when a session exists', async () => {
        fetchAuthSession.mockResolvedValue({ tokens: { accessToken: { toString: () => 'aaa.bbb.ccc' } },});
        const token = await getToken();
        expect(token).toBe('aaa.bbb.ccc');
    });

    it('returns null when session has no tokens', async () => {
        fetchAuthSession.mockResolvedValue({ tokens: null });
        expect(await getToken()).toBeNull();
    });

    it('returns null when thrown', async () => {
        fetchAuthSession.mockResolvedValue(new Error('network error'));
        expect(await getToken()).toBeNull();
    });
});

describe('isAuthenticated', () => {
    it('returns true when valid session with existing token', async () => {
        fetchAuthSession.mockResolvedValue({ tokens: { accessToken: 'test'} });
        expect(await isAuthenticated()).toBe(true);
    });

    it('returns false when no token', async () => {
        fetchAuthSession.mockResolvedValue({ tokens: { accessToken: null} });
        expect(await isAuthenticated()).toBe(false);
    });

    it('returns false when thrown', async () => {
        fetchAuthSession.mockRejectedValue(new Error('network error'));
        expect(await isAuthenticated()).toBe(false);
    });
});

describe('getCurrentUserProfile', () => {
    it('returns sub, email and full name from current user and token', async () => {
        getCurrentUser.mockResolvedValue({ userId: 'user-123'});
        fetchAuthSession.mockResolvedValue({ tokens: { idToken: { payload: { email: 'john@example.com', name: 'John Pork'} } } });
        const profile = await getCurrentUserProfile();
        expect(profile).toEqual({ sub: 'user-123', email: 'john@example.com', full_name: 'John Pork' });
    });

    it('falls back to empty strings when payload is empty', async () => {
        getCurrentUser.mockResolvedValue({ userId: 'user-123'});
        fetchAuthSession.mockResolvedValue({ tokens: { idToken: { payload: {} },},});
        const profile = await getCurrentUserProfile();
        expect(profile).toEqual({ sub: 'user-123', email: '', full_name: '' });
    });

    it('falls back to empty when no idToken', async () => {
        getCurrentUser.mockResolvedValue({ userId: 'user-123' });
        fetchAuthSession.mockResolvedValue({ tokens: {} });
        const profile = await getCurrentUserProfile();
        expect(profile).toEqual({ sub: 'user-123', email: '', full_name: ''});
    });
});

