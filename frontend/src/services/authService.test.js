import { confirmSignIn, confirmSignUp, setUpTOTP, signIn, signOut, signUp } from "aws-amplify/auth";
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

import { confirmRegistration, register, login, respondToMFA, initTOTPSetup, logout } from "./authService";

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
