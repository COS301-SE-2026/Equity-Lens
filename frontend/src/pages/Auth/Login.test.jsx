import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getGuestModeStatus } from '../../services/authService';

import Login from './Login';

const mockStartGuest = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  default: () => ({
    login: vi.fn(),
    submitMFACode: vi.fn(),
    activateTOTP: vi.fn(),
    startGuest: mockStartGuest,
  }),
}));

vi.mock('../../services/authService', () => ({
  getGuestModeStatus: vi.fn(),
}));

/** @param {string} [path] */
const renderLogin = (path = '/login') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe('Login guest option', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('offers Continue as guest when the server has guest mode on', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    renderLogin();

    expect(await screen.findByRole('button', { name: /continue as guest/i })).toBeInTheDocument();
    expect(screen.queryByText(/no sign-up or authenticator app needed/i)).not.toBeInTheDocument();
  });

  it('hides the option when guest mode is off', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(false);
    renderLogin();

    await waitFor(() => expect(getGuestModeStatus).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument();
  });

  it('starts a guest session and lands on the dashboard', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockStartGuest.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderLogin();

    await user.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(mockStartGuest).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
  });

  it('says the demo is busy when the server is at capacity', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockStartGuest.mockRejectedValue({ response: { status: 503 } });
    const user = userEvent.setup();
    renderLogin();

    await user.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The demo is busy, try again in a minute.',
    );
  });

  it('explains a per-network limit', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockStartGuest.mockRejectedValue({ response: { status: 429 } });
    const user = userEvent.setup();
    renderLogin();

    await user.click(await screen.findByRole('button', { name: /continue as guest/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many guest sessions/i);
  });

  it('hides the option if guest mode was switched off since the page loaded', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    mockStartGuest.mockRejectedValue({ response: { status: 404 } });
    const user = userEvent.setup();
    renderLogin();

    await user.click(await screen.findByRole('button', { name: /continue as guest/i }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /continue as guest/i })).not.toBeInTheDocument(),
    );
  });

  it('tells a returning visitor their guest session ended', async () => {
    vi.mocked(getGuestModeStatus).mockResolvedValue(true);
    renderLogin('/login?guest=ended');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your guest session ended. Start a new one or create an account.',
    );
  });
});
