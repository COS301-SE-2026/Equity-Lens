import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuthContext } from './AuthContext';

vi.mock('../services/authService', () => ({
  register: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  isAuthenticated: vi.fn(),
}));

import {
  register as registerService,
  login as loginService,
  logout as logoutService,
  getCurrentUser,
  isAuthenticated,
} from '../services/authService';

const TestConsumer = () => {
  const { user, loading, error, isAuthenticated: isAuth } = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'null'}</span>
      <span data-testid="error">{error || 'null'}</span>
      <span data-testid="isAuthenticated">{String(isAuth)}</span>
    </div>
  );
};

const renderWithAuth = () =>
  render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthContext', () => {

  describe('initial state', () => {
    it('sets loading to false after init when not authenticated', async () => {
      isAuthenticated.mockReturnValue(false);
      renderWithAuth();
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
    });

    it('user is null when not authenticated', async () => {
      isAuthenticated.mockReturnValue(false);
      renderWithAuth();
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null');
      });
    });

    it('loads user from token on mount when authenticated', async () => {
      isAuthenticated.mockReturnValue(true);
      getCurrentUser.mockResolvedValueOnce({ email: 'test@test.com', full_name: 'Test User' });
      renderWithAuth();
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('test@test.com');
      });
    });

    it('clears user if getCurrentUser fails on mount', async () => {
      isAuthenticated.mockReturnValue(true);
      getCurrentUser.mockRejectedValueOnce(new Error('Unauthorised'));
      renderWithAuth();
      await waitFor(() => {
        expect(screen.getByTestId('user').textContent).toBe('null');
      });
    });

    it('calls logoutService if getCurrentUser fails on mount', async () => {
      isAuthenticated.mockReturnValue(true);
      getCurrentUser.mockRejectedValueOnce(new Error('Unauthorised'));
      renderWithAuth();
      await waitFor(() => {
        expect(logoutService).toHaveBeenCalled();
      });
    });
  });

  describe('useAuthContext', () => {
    it('throws when used outside AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => render(<TestConsumer />)).toThrow(
        'useAuthContext must be used within AuthProvider'
      );
      consoleError.mockRestore();
    });
  });

  describe('register', () => {
    it('calls registerService with correct args', async () => {
      isAuthenticated.mockReturnValue(false);
      registerService.mockResolvedValueOnce({});

      const TestRegister = () => {
        const { register } = useAuthContext();
        return (
          <button onClick={() => register('Test User', 'test@test.com', 'Password1!')}>
            Register
          </button>
        );
      };

      const { getByText } = render(
        <AuthProvider><TestRegister /></AuthProvider>
      );

      await waitFor(() => {});
      await act(async () => { getByText('Register').click(); });
      expect(registerService).toHaveBeenCalledWith('Test User', 'test@test.com', 'Password1!');
    });

    it('throws and sets error on registration failure', async () => {
      isAuthenticated.mockReturnValue(false);
      registerService.mockRejectedValueOnce({
        response: { data: { detail: 'Email already exists' } },
      });

      let capturedError = null;
      const TestRegister = () => {
        const { register, error } = useAuthContext();
        return (
          <div>
            <span data-testid="reg-error">{error || 'null'}</span>
            <button onClick={async () => {
              try { await register('Test', 'test@test.com', 'Password1!'); }
              catch (e) { capturedError = e.message; }
            }}>Register</button>
          </div>
        );
      };

      const { getByText } = render(
        <AuthProvider><TestRegister /></AuthProvider>
      );

      await waitFor(() => {});
      await act(async () => { getByText('Register').click(); });
      expect(capturedError).toBe('Email already exists');
    });
  });

  describe('login', () => {
    it('sets user after successful login', async () => {
      isAuthenticated.mockReturnValue(false);
      loginService.mockResolvedValueOnce({ access_token: 'token' });
      getCurrentUser.mockResolvedValueOnce({ email: 'test@test.com' });

      const TestLogin = () => {
        const { login, user } = useAuthContext();
        return (
          <div>
            <span data-testid="login-user">{user ? user.email : 'null'}</span>
            <button onClick={() => login('test@test.com', 'Password1!')}>Login</button>
          </div>
        );
      };

      const { getByText } = render(
        <AuthProvider><TestLogin /></AuthProvider>
      );

      await waitFor(() => {});
      await act(async () => { getByText('Login').click(); });
      await waitFor(() => {
        expect(screen.getByTestId('login-user').textContent).toBe('test@test.com');
      });
    });

    it('sets error and throws on login failure', async () => {
      isAuthenticated.mockReturnValue(false);
      loginService.mockRejectedValueOnce({
        response: { data: { detail: 'Invalid credentials' } },
      });

      let capturedError = null;
      const TestLogin = () => {
        const { login, error } = useAuthContext();
        return (
          <div>
            <span data-testid="login-error">{error || 'null'}</span>
            <button onClick={async () => {
              try { await login('test@test.com', 'wrong'); }
              catch (e) { capturedError = e.message; }
            }}>Login</button>
          </div>
        );
      };

      const { getByText } = render(
        <AuthProvider><TestLogin /></AuthProvider>
      );

      await waitFor(() => {});
      await act(async () => { getByText('Login').click(); });
      expect(capturedError).toBe('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('clears user on logout', async () => {
      isAuthenticated.mockReturnValue(true);
      getCurrentUser.mockResolvedValueOnce({ email: 'test@test.com' });

      const TestLogout = () => {
        const { logout, user } = useAuthContext();
        return (
          <div>
            <span data-testid="logout-user">{user ? user.email : 'null'}</span>
            <button onClick={logout}>Logout</button>
          </div>
        );
      };

      const { getByText } = render(
        <AuthProvider><TestLogout /></AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('logout-user').textContent).toBe('test@test.com');
      });

      await act(async () => { getByText('Logout').click(); });
      expect(screen.getByTestId('logout-user').textContent).toBe('null');
    });

    it('calls logoutService on logout', async () => {
      isAuthenticated.mockReturnValue(false);

      const TestLogout = () => {
        const { logout } = useAuthContext();
        return <button onClick={logout}>Logout</button>;
      };

      const { getByText } = render(
        <AuthProvider><TestLogout /></AuthProvider>
      );

      await waitFor(() => {});
      await act(async () => { getByText('Logout').click(); });
      expect(logoutService).toHaveBeenCalled();
    });
  });
});