import { confirmSignUp, signUp } from "aws-amplify/auth";
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

import { confirmRegistration, register } from "./authService";

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