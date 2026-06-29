import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Element.prototype.scrollIntoView = vi.fn();

vi.mock('aws-amplify/auth', () => { const defaultSignInState = { isSignedIn: true, nextStep: { signInStep: 'DONE' } };

  return {
    signUp: vi.fn().mockResolvedValue({ userId: 'mock-user-id', isSignUpComplete: false }),
    confirmSignUp: vi.fn().mockResolvedValue({ isSignUpComplete: true }),
    signIn: vi.fn().mockResolvedValue(defaultSignInState),
    signOut: vi.fn().mockResolvedValue(),
    getCurrentUser: vi.fn().mockResolvedValue({ userId: 'mock-user-id', username: 'mock@test.com' }),
    fetchAuthSession: vi.fn().mockResolvedValue({
      tokens: {
        accessToken: { toString: () => 'mock-access-token' },
        idToken: { payload: { email: 'mock@test.com', name: 'Mock User', sub: 'mock-sub' } },
      },
    }),
    confirmSignIn: vi.fn().mockResolvedValue(defaultSignInState),
    setUpTOTP: vi.fn().mockResolvedValue({ sharedSecret: 'JBSWY3DPEHPK3PXP' }),
    verifyTOTPSetup: vi.fn().mockResolvedValue(),
    updateMFAPreference: vi.fn().mockResolvedValue(),
  };
});

vi.mock('aws-amplify', () => ({Amplify: { configure: vi.fn() },}));