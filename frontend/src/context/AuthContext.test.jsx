import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as authService from '../services/authService';
import { AuthProvider, useAuthContext } from './AuthContext';

vi.mock('../services/authService');

function TestConsumer({ onAction }) {
  const ctx = useAuthContext();
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="auth">{String(ctx.isAuthenticated)}</span>
      <span data-testid="email">{ctx.user?.email || ''}</span>
      <span data-testid="mfa">{ctx.mfaState?.type || ''}</span>
      <button onClick={() => onAction?.(ctx)}>run</button>
    </div>
  );
}

const renderAuth = (onAction) =>
  render(
    <AuthProvider>
      <TestConsumer onAction={onAction} />
    </AuthProvider>
  );

describe('AuthContext', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('initializes user state based on auth status or errors', async () => {
    vi.mocked(authService.isAuthenticated).mockResolvedValueOnce(false);
    const { unmount } = renderAuth();

    expect(screen.getByTestId('loading')).toHaveTextContent('true');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('auth')).toHaveTextContent('false');
    unmount();

    // Resolves user when authenticated
    vi.mocked(authService.isAuthenticated).mockResolvedValueOnce(true);
    vi.mocked(authService.getCurrentUserProfile).mockResolvedValueOnce({ email: 'jane@example.com' });
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('jane@example.com'));
  });

  it('bypasses real auth check during E2E testing', async () => {
    vi.stubGlobal('__E2E_AUTH_BYPASS__', { email: 'e2e@example.com' });
    renderAuth();

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('e2e@example.com'));
    expect(authService.isAuthenticated).not.toHaveBeenCalled();
  });

  it('handles registration flow and surfaces errors', async () => {
    vi.mocked(authService.isAuthenticated).mockResolvedValue(false);
    let error = null;

    const user = userEvent.setup();
    renderAuth(async (ctx) => {
      try {
        await ctx.register('Jane', 'jane@example.com', 'pw123456');
      } catch (err) {
        error = err;
      }
    });

    vi.mocked(authService.register).mockRejectedValueOnce(new Error('email already registered'));
    await user.click(screen.getByText('run'));

    expect(authService.register).toHaveBeenCalledWith('Jane', 'jane@example.com', 'pw123456');
    expect(error?.message).toBe('email already registered');
  });

  it('handles login steps for TOTP setup, verification, and completion', async () => {
    vi.mocked(authService.isAuthenticated).mockResolvedValue(false);
    const user = userEvent.setup();

    // 1. TOTP Setup
    vi.mocked(authService.login).mockResolvedValueOnce({
      nextStep: { signInStep: 'CONTINUE_SIGN_IN_WITH_TOTP_SETUP' },
    });
    renderAuth((ctx) => ctx.login('jane@example.com', 'pw'));
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(screen.getByTestId('mfa')).toHaveTextContent('SETUP'));

    // 2. Sign-in complete
    vi.mocked(authService.login).mockResolvedValueOnce({ nextStep: { signInStep: 'DONE' } });
    vi.mocked(authService.getCurrentUserProfile).mockResolvedValueOnce({ email: 'jane@example.com' });
    await user.click(screen.getByText('run'));
    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('true'));
  });

  it('clears state on logout even if network request fails', async () => {
    vi.mocked(authService.isAuthenticated).mockResolvedValue(true);
    vi.mocked(authService.getCurrentUserProfile).mockResolvedValue({ email: 'jane@example.com' });
    vi.mocked(authService.logout).mockRejectedValue(new Error('Network error'));

    const user = userEvent.setup();
    renderAuth((ctx) => ctx.logout());

    await waitFor(() => expect(screen.getByTestId('email')).toHaveTextContent('jane@example.com'));
    await user.click(screen.getByText('run'));

    await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('false'));
    expect(screen.getByTestId('email')).toHaveTextContent('');
  });

  it('throws error when context is accessed outside AuthProvider', () => {
    const Component = () => (useAuthContext(), null);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Component />)).toThrow('useAuthContext must be used in AuthProvider');
  });
});